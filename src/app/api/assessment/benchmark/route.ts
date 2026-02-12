import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("templateId");
  const skillGroupId = searchParams.get("skillGroupId");

  if (!templateId || !skillGroupId) {
    return NextResponse.json(
      { error: "templateId and skillGroupId are required" },
      { status: 400 }
    );
  }

  const supabase = db();

  const { data, error } = await supabase.rpc("rpc_skill_group_benchmark", {
    p_template_id: templateId,
    p_skill_group_id: skillGroupId,
    p_submitted_year: searchParams.get("submittedYear")
      ? Number(searchParams.get("submittedYear"))
      : null,
    p_country: searchParams.get("country") || null,
    p_industry: searchParams.get("industry") || null,
    p_job_level: searchParams.get("jobLevel") || null,
    p_functional_area: searchParams.get("functionalArea") || null,
    p_role: searchParams.get("role") || null,
    p_region: searchParams.get("region") || null,
    p_sub_region: searchParams.get("subRegion") || null,
    p_years_experience: searchParams.get("yearsExperience")
      ? Number(searchParams.get("yearsExperience"))
      : null,
    p_education_level: searchParams.get("educationLevel") || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data?.[0] ?? null);
}
