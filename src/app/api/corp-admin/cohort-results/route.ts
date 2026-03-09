import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type SkillGroupResult = {
  id: string;
  name: string;
  userScore: number;
  totalPossible: number;
};

type SkillScore = {
  name: string;
  groupId: string;
  templateSkillId: string;
  maxPoints: number;
  rawScore: number;
};

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
    .select("id, template_id, company_id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();
  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!cohort.template_id || !cohort.company_id) {
    return NextResponse.json(
      { error: "Cohort missing template/company mapping" },
      { status: 400 }
    );
  }

  const templateId = cohort.template_id;
  const corporationId = cohort.company_id;

  const [{ data: templateSkills }, { data: members }] = await Promise.all([
    supabase
      .from("template_skills")
      .select("id, name, max_points, skill_group_id")
      .contains("meta_json", { template_ids: [templateId] }),
    supabase.from("cohort_members").select("user_id").eq("cohort_id", cohortId).eq("role", "user"),
  ]);

  const skillGroupIds = [
    ...new Set(
      (templateSkills ?? [])
        .map((row) => row.skill_group_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const { data: skillGroups } = skillGroupIds.length
    ? await supabase
        .from("template_skill_groups")
        .select("id, name")
        .in("id", skillGroupIds)
        .order("name")
    : { data: [] as Array<{ id: string; name: string }> };

  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  const referenceTemplateSkillIds = (templateSkills ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (userIds.length === 0) {
    const emptyResults: SkillGroupResult[] = (skillGroups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      userScore: 0,
      totalPossible: 0,
    }));

    return NextResponse.json({
      hasResults: false,
      templateId,
      corporationId,
      cohortId,
      skillGroupResults: emptyResults,
      skillScores: [] satisfies SkillScore[],
      feedbackText: "",
    });
  }

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id")
    .in("user_id", userIds)
    .in("status", ["submitted", "in_review", "reviewed", "completed"]);

  const assessmentIds = (assessments ?? []).map((a) => a.id).filter(Boolean);
  const hasResults = assessmentIds.length > 0;

  const { data: scoreRows } = assessmentIds.length && referenceTemplateSkillIds.length
    ? await supabase
        .from("assessment_skill_scores")
        .select(
          "assessment_id, reviewer_score, final_score, points, template_skill_id, template_skills(name, skill_group_id, max_points)"
        )
        .in("assessment_id", assessmentIds)
        .in("template_skill_id", referenceTemplateSkillIds)
    : { data: [] as Array<Record<string, unknown>> };

  // Pre-compute totalPossible per group from the skill list (fixed, not per-assessment)
  const groupPossible = new Map<string, number>();
  for (const ts of templateSkills ?? []) {
    if (!ts.skill_group_id) continue;
    groupPossible.set(
      ts.skill_group_id,
      (groupPossible.get(ts.skill_group_id) ?? 0) + Number(ts.max_points ?? 0)
    );
  }

  const skillAgg = new Map<
    string,
    { name: string; groupId: string; maxPoints: number; total: number; assessmentIds: Set<string> }
  >();

  for (const row of scoreRows ?? []) {
    const scoreValue = row.reviewer_score ?? row.final_score ?? row.points;
    const finalScore = Number(scoreValue);
    if (!Number.isFinite(finalScore)) continue;

    const assessmentId = typeof row.assessment_id === "string" ? row.assessment_id : null;
    const templateSkillId =
      typeof row.template_skill_id === "string" ? row.template_skill_id : null;
    const skill = row.template_skills as
      | { name?: string; skill_group_id?: string; max_points?: number }
      | null;
    const groupId =
      skill && typeof skill.skill_group_id === "string" ? skill.skill_group_id : null;
    const maxPoints =
      skill && typeof skill.max_points === "number" ? Number(skill.max_points) : 0;
    const skillName =
      skill && typeof skill.name === "string" ? skill.name : "Unknown Skill";

    if (!groupId || !templateSkillId || !assessmentId) continue;

    const skillCurrent = skillAgg.get(templateSkillId) ?? {
      name: skillName,
      groupId,
      maxPoints,
      total: 0,
      assessmentIds: new Set<string>(),
    };
    skillCurrent.total += finalScore;
    skillCurrent.assessmentIds.add(assessmentId);
    skillAgg.set(templateSkillId, skillCurrent);
  }

  const skillGroupResults: SkillGroupResult[] = (skillGroups ?? []).map((group) => {
    // Sum per-skill averages so the group total is consistent with what the sidebar shows
    let userScore = 0;
    for (const agg of skillAgg.values()) {
      if (agg.groupId !== group.id) continue;
      if (agg.assessmentIds.size > 0) {
        userScore += agg.total / agg.assessmentIds.size;
      }
    }
    return {
      id: group.id,
      name: group.name,
      userScore,
      totalPossible: groupPossible.get(group.id) ?? 0,
    };
  });

  const skillScores: SkillScore[] = [...skillAgg.entries()].map(([templateSkillId, agg]) => ({
    name: agg.name,
    groupId: agg.groupId,
    templateSkillId,
    maxPoints: agg.maxPoints,
    rawScore: agg.assessmentIds.size > 0 ? agg.total / agg.assessmentIds.size : 0,
  }));

  return NextResponse.json({
    hasResults,
    templateId,
    corporationId,
    cohortId,
    skillGroupResults,
    skillScores,
    feedbackText: "",
  });
}
