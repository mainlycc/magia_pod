import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteInvoice as deleteFakturowniaInvoice,
  type FakturowniaConfig,
} from "@/lib/fakturownia/client";

async function checkAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get("trip_id");

    let query = supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        amount_cents,
        status,
        created_at,
        updated_at,
        booking_id,
        fakturownia_invoice_id,
        invoice_provider_error,
        bookings (
          id,
          booking_ref,
          contact_email,
          trip_id,
          trips (
            id,
            title,
            price_cents,
            reservation_number
          ),
          agreements:agreements (
            id,
            status,
            agreement_seq
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (tripId) {
      query = query.eq("bookings.trip_id", tripId);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error("Error fetching invoices:", error);
      return NextResponse.json(
        { error: "Failed to fetch invoices", details: error.message },
        { status: 500 }
      );
    }

    // When filtering by trip_id via join, invoices with non-matching bookings
    // still appear but with null bookings — filter them out client-side
    const filtered = tripId
      ? (invoices || []).filter((inv) => inv.bookings !== null)
      : invoices || [];

    const invoicesWithParticipants = await Promise.all(
      filtered.map(async (invoice) => {
        if (!invoice.booking_id) {
          return { ...invoice, participants_count: 0 };
        }
        const { count } = await supabase
          .from("participants")
          .select("*", { count: "exact", head: true })
          .eq("booking_id", invoice.booking_id);
        return { ...invoice, participants_count: count || 0 };
      })
    );

    return NextResponse.json(invoicesWithParticipants);
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Usuwa zaznaczone faktury z bazy i (jeśli możliwe) z Fakturowni.
 * Body: { ids: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter(
          (id: unknown): id is string => typeof id === "string" && id.length > 0
        )
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "brak_zaznaczonych_faktur" },
        { status: 400 }
      );
    }

    if (ids.length > 50) {
      return NextResponse.json(
        { error: "Maksymalnie 50 faktur na raz" },
        { status: 400 }
      );
    }

    const { data: invoices, error: fetchError } = await supabase
      .from("invoices")
      .select("id, invoice_number, fakturownia_invoice_id, pdf_storage_path")
      .in("id", ids);

    if (fetchError) {
      console.error("DELETE /api/invoices fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch invoices", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
    }

    const config: FakturowniaConfig = {
      apiToken: process.env.FAKTUROWNIA_API_TOKEN || "",
      subdomain: process.env.FAKTUROWNIA_SUBDOMAIN || "",
    };

    const results: {
      id: string;
      invoice_number: string;
      deleted: boolean;
      fakturownia_deleted?: boolean;
      error?: string;
    }[] = [];

    for (const invoice of invoices) {
      let fakturowniaDeleted: boolean | undefined;

      if (invoice.fakturownia_invoice_id && config.apiToken && config.subdomain) {
        const remote = await deleteFakturowniaInvoice(
          config,
          invoice.fakturownia_invoice_id
        );
        fakturowniaDeleted = remote.success;
        if (!remote.success) {
          console.warn(
            `[DELETE invoices] Fakturownia delete failed for ${invoice.id}:`,
            remote.error
          );
        }
      }

      if (invoice.pdf_storage_path) {
        const { error: storageError } = await supabase.storage
          .from("invoices")
          .remove([invoice.pdf_storage_path]);
        if (storageError) {
          console.warn(
            `[DELETE invoices] Storage remove failed for ${invoice.id}:`,
            storageError.message
          );
        }
      }

      const { error: deleteError } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id);

      if (deleteError) {
        results.push({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          deleted: false,
          fakturownia_deleted: fakturowniaDeleted,
          error: deleteError.message,
        });
      } else {
        results.push({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          deleted: true,
          fakturownia_deleted: fakturowniaDeleted,
        });
      }
    }

    const deletedCount = results.filter((r) => r.deleted).length;
    const failedCount = results.filter((r) => !r.deleted).length;

    return NextResponse.json({
      success: failedCount === 0,
      deletedCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error("DELETE /api/invoices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
