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
  const cohortId = searchParams.get("cohortId");
  const skillGroupId = searchParams.get("skillGroupId");

  if (!cohortId || !skillGroupId) {
    return NextResponse.json({ error: "cohortId and skillGroupId are required" }, { status: 400 });
  }

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("template_id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();
  if (!cohort) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!cohort.template_id) {
    return NextResponse.json({ error: "Cohort missing template mapping" }, { status: 400 });
  }

  const yearsExperience = await resolveYearsExperienceValue(
    supabase,
    searchParams.get("yearsExperience")
  );

  const { data, error } = await supabase.rpc("rpc_skill_group_benchmark_v2", {
    p_skill_group_id: skillGroupId,
    p_cohort_template_id: cohort.template_id,
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
    console.error("[corp-admin/benchmark]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data?.[0] ?? null);
}
