import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AirportOption = {
  code: string;
  name: string;
};

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 50;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const code = searchParams.get("code")?.trim().toUpperCase() ?? "";

    if (code) {
      const { data, error } = await supabase
        .from("airports")
        .select("code, name")
        .eq("code", code)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ airport: data });
    }

    if (q.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ airports: [] as AirportOption[] });
    }

    const escaped = q.replace(/[%_,]/g, "");
    const { data, error } = await supabase
      .from("airports")
      .select("code, name")
      .or(`code.ilike.%${escaped}%,name.ilike.%${escaped}%`)
      .order("code")
      .limit(MAX_RESULTS);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ airports: data ?? [] });
  } catch (error) {
    console.error("Airports search failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
