import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const supabase = db();

  const { data: templates, error } = await supabase
    .from("assessment_templates")
    .select("id, title")
    .order("title");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json(templates ?? [], { headers: corsHeaders });
}
