import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type CohortSettingsData = {
  individual_result_visibility: boolean;
  reminders_enabled: boolean;
  reviewers_enabled: boolean;
  grouping_enabled: boolean;
};

async function resolveAdminProfile(userId: string) {
  const supabase = db();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  return { supabase, profile };
}

async function verifyCohortAdmin(
  supabase: ReturnType<typeof db>,
  cohortId: string,
  profileId: string
) {
  const { data } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", cohortId)
    .eq("admin_id", profileId)
    .maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const { supabase, profile } = await resolveAdminProfile(userId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (!(await verifyCohortAdmin(supabase, cohortId, profile.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase
    .from("cohort_settings")
    .select("individual_result_visibility, reminders_enabled, reviewers_enabled, grouping_enabled")
    .eq("cohort_id", cohortId)
    .maybeSingle();

  // Return defaults if no row exists yet
  const settings: CohortSettingsData = {
    individual_result_visibility: data?.individual_result_visibility ?? false,
    reminders_enabled: data?.reminders_enabled ?? false,
    reviewers_enabled: data?.reviewers_enabled ?? false,
    grouping_enabled: data?.grouping_enabled ?? false,
  };

  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { cohortId, individual_result_visibility, reminders_enabled, reviewers_enabled, grouping_enabled } =
    body ?? {};

  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const { supabase, profile } = await resolveAdminProfile(userId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (!(await verifyCohortAdmin(supabase, cohortId, profile.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("cohort_settings").upsert(
    {
      cohort_id: cohortId,
      individual_result_visibility,
      reminders_enabled,
      reviewers_enabled,
      grouping_enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cohort_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
