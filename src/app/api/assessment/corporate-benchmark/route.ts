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
  const corporationId = searchParams.get("corporationId");
  const cohortId = searchParams.get("cohortId");
  const templateId = searchParams.get("templateId");
  const skillGroupId = searchParams.get("skillGroupId");

  if (!corporationId || !cohortId || !templateId || !skillGroupId) {
    return NextResponse.json(
      { error: "corporationId, cohortId, templateId, and skillGroupId are required" },
      { status: 400 }
    );
  }

  const supabase = db();
  const yearsExperience = await resolveYearsExperienceValue(
    supabase,
    searchParams.get("yearsExperience")
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: cohortMember } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", profile.id)
    .eq("cohort_id", cohortId)
    .limit(1)
    .maybeSingle();

  const { data: cohortAdmin } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();

  if (!cohortMember && !cohortAdmin) {
    return NextResponse.json(
      { error: "Forbidden: cohort access denied" },
      { status: 403 }
    );
  }

  const rpcArgs = {
    p_corporation_id: corporationId,
    p_cohort_id: cohortId,
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
    p_years_experience: yearsExperience,
    p_education_level: searchParams.get("educationLevel") || null,
  };

  const { data, error } = await supabase.rpc(
    "rpc_corporate_skill_group_benchmark",
    rpcArgs
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data?.[0] ?? null);
}
