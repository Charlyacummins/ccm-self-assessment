import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveYearsExperienceValue } from "@/lib/years-experience";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const templateSkillId = searchParams.get("templateSkillId");

  if (!templateSkillId) {
    return NextResponse.json({ error: "templateSkillId is required" }, { status: 400 });
  }

  const supabase = db();
  const yearsExperience = await resolveYearsExperienceValue(
    supabase,
    searchParams.get("yearsExperience")
  );

  const { data, error } = await supabase.rpc("rpc_dynamic_skill_benchmark_live_v2", {
    p_template_skill_id: templateSkillId,
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
    p_years_experience: yearsExperience,
    p_education_level: searchParams.get("educationLevel") || null,
  });

  if (error) {
    console.error("[corp-admin/skill-benchmark]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data?.[0] ?? null);
}
