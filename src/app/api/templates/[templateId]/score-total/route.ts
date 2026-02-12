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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;

  const supabase = db();

  const { data: skills, error } = await supabase
    .from("template_skills")
    .select("max_points")
    .contains("meta_json", { template_ids: [templateId] });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  const totalPoints = (skills ?? []).reduce(
    (sum, s) => sum + (s.max_points ?? 0),
    0
  );

  return NextResponse.json({
    templateId,
    skillCount: skills?.length ?? 0,
    totalPoints,
  }, { headers: corsHeaders });
}
