import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type CohortOverviewData = {
  questions: number;
  sections: number;
  timeLabel: string;
  status: string | null;
  invitees: number;
  reviewersEnabled: boolean;
};

function formatTimeLabel(questions: number) {
  const estLow = Math.max(1, Math.ceil(questions * 0.5));
  const estHigh = Math.max(1, Math.ceil(questions * 0.75));
  return estLow === estHigh ? `~${estLow} mins` : `${estLow}-${estHigh} mins`;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, template_id, status, seats_used")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();

  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templateId = cohort.template_id;

  const [questionResult, sectionSkillsResult, settingsResult] = await Promise.all([
    templateId
      ? supabase
          .from("template_skills")
          .select("id", { count: "exact", head: true })
          .contains("meta_json", { template_ids: [templateId] })
      : Promise.resolve({ count: 0 }),
    templateId
      ? supabase
          .from("template_skills")
          .select("skill_group_id")
          .contains("meta_json", { template_ids: [templateId] })
      : Promise.resolve({ data: [] as Array<{ skill_group_id: string | null }> }),
    supabase
      .from("cohort_settings")
      .select("reviewers_enabled")
      .eq("cohort_id", cohortId)
      .maybeSingle(),
  ]);

  const questions = questionResult.count ?? 0;
  const sections = new Set(
    (sectionSkillsResult.data ?? [])
      .map((row) => row.skill_group_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  ).size;
  const invitees = Number(cohort.seats_used ?? 0);

  const payload: CohortOverviewData = {
    questions,
    sections,
    timeLabel: formatTimeLabel(questions),
    status: cohort.status ?? null,
    invitees,
    reviewersEnabled: settingsResult.data?.reviewers_enabled ?? false,
  };

  return NextResponse.json(payload);
}
