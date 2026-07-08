import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDefaultOwuEmailSettings,
  isValidInsuranceOwuType,
} from "@/lib/insurance-local/owu-constants";
import { canManageInsuranceOwu } from "@/lib/insurance-local/owu-auth";
import {
  buildOwuDocumentsMap,
  listResolvedOwuDocuments,
} from "@/lib/insurance-local/owu-resolve";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await context.params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const [tripDocsRes, globalDocsRes, emailSettingsRes] = await Promise.all([
      supabase.from("trip_insurance_owu_documents").select("*").eq("trip_id", tripId),
      supabase.from("global_insurance_owu_documents").select("*"),
      supabase
        .from("trip_insurance_owu_email_settings")
        .select("insurance_type, attach_on_reservation")
        .eq("trip_id", tripId),
    ]);

    if (tripDocsRes.error) {
      console.error("Error fetching trip insurance OWU documents:", tripDocsRes.error);
    }
    if (globalDocsRes.error) {
      console.error("Error fetching global insurance OWU documents:", globalDocsRes.error);
    }
    if (emailSettingsRes.error) {
      console.error("Error fetching trip insurance OWU email settings:", emailSettingsRes.error);
    }

    const emailSettings = buildDefaultOwuEmailSettings();
    for (const row of emailSettingsRes.data || []) {
      if (isValidInsuranceOwuType(row.insurance_type)) {
        emailSettings[row.insurance_type] = row.attach_on_reservation;
      }
    }

    const documentsMap = buildOwuDocumentsMap({
      tripDocs: tripDocsRes.data || [],
      globalDocs: globalDocsRes.data || [],
    });

    const documents = listResolvedOwuDocuments(documentsMap).map((doc) => {
      const {
        data: { publicUrl },
      } = adminClient.storage.from("documents").getPublicUrl(doc.file_name);

      return {
        ...doc,
        url: publicUrl,
      };
    });

    return NextResponse.json({ documents, email_settings: emailSettings });
  } catch (error) {
    console.error("GET /api/insurance-local/owu/trip/[tripId] error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await context.params;
    const supabase = await createClient();

    if (!(await canManageInsuranceOwu(supabase, tripId))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const insuranceTypeRaw = formData.get("insurance_type");
    const displayName = formData.get("display_name") as string | null;
    const insuranceType =
      typeof insuranceTypeRaw === "string" ? parseInt(insuranceTypeRaw, 10) : insuranceTypeRaw;

    if (!file) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }

    if (!isValidInsuranceOwuType(insuranceType)) {
      return NextResponse.json({ error: "invalid_insurance_type" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    const fileName = `insurance-owu/${tripId}/type-${insuranceType}-${Date.now()}.pdf`;
    const adminClient = createAdminClient();

    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.id === "documents");

    if (!bucketExists) {
      const { error: createBucketError } = await adminClient.storage.createBucket("documents", {
        public: true,
        allowedMimeTypes: ["application/pdf"],
      });

      if (createBucketError) {
        console.error("Error creating bucket:", createBucketError);
      }
    }

    const { data: existingDoc } = await supabase
      .from("trip_insurance_owu_documents")
      .select("file_name")
      .eq("trip_id", tripId)
      .eq("insurance_type", insuranceType)
      .single();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    const documentData = {
      trip_id: tripId,
      insurance_type: insuranceType,
      file_name: fileName,
      display_name: displayName || null,
    };

    const { data: savedDoc, error: dbError } = await supabase
      .from("trip_insurance_owu_documents")
      .upsert(documentData, {
        onConflict: "trip_id,insurance_type",
      })
      .select()
      .single();

    if (dbError) {
      await adminClient.storage.from("documents").remove([fileName]);
      console.error("Database error:", dbError);
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    if (existingDoc?.file_name && existingDoc.file_name !== fileName) {
      try {
        await adminClient.storage.from("documents").remove([existingDoc.file_name]);
      } catch (removeError) {
        console.error("Error removing old file:", removeError);
      }
    }

    const {
      data: { publicUrl },
    } = adminClient.storage.from("documents").getPublicUrl(fileName);

    return NextResponse.json({
      ...savedDoc,
      url: publicUrl,
      source: "trip",
      success: true,
    });
  } catch (error) {
    console.error("POST /api/insurance-local/owu/trip/[tripId] error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
