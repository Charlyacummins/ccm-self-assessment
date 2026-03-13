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

  // Accept multiple skillGroupId params: ?skillGroupId=a&skillGroupId=b
  const skillGroupIds = searchParams.getAll("skillGroupId");

  if (!cohortId || skillGroupIds.length === 0) {
    return NextResponse.json(
      { error: "cohortId and at least one skillGroupId are required" },
      { status: 400 }
    );
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

  // Verify admin owns this cohort
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();
  if (!cohort) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const yearsExperience = await resolveYearsExperienceValue(
    supabase,
    searchParams.get("yearsExperience")
  );

  const rpcParams = {
    p_skill_group_ids: skillGroupIds,
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

  // Retry once on statement timeout — first load hits a cold materialized view
  // cache; the second attempt succeeds once Postgres pages are in shared_buffers.
  let data, error;
  for (let attempt = 0; attempt < 2; attempt++) {
    ({ data, error } = await supabase.rpc(
      "rpc_skill_group_benchmark_v2",
      rpcParams
    ));
    if (!error || !error.message.includes("statement timeout")) break;
    console.warn(
      `[corp-admin/benchmark] statement timeout on attempt ${attempt + 1}, retrying…`
    );
  }

  if (error) {
    console.error("[corp-admin/benchmark]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return a map keyed by skill_group_id
  const result: Record<string, (typeof data)[number]> = {};
  for (const row of data ?? []) {
    result[row.skill_group_id] = row;
  }

  return NextResponse.json(result);
}
