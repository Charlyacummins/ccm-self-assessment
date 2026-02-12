import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ResultsAtAGlance } from "@/components/dashboard/results-at-a-glance";
import { LearningPaths } from "@/components/dashboard/learning-paths";
import { ScoresByCategory } from "@/components/dashboard/scores-by-category";
import { StartQuestionnaire } from "@/components/dashboard/start-questionnaire";
import { UpcomingWebinars } from "@/components/dashboard/upcoming-webinars";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  // Resolve template_id: check if user has a cohort with a different template, otherwise default
  let templateId = DEFAULT_TEMPLATE_ID;
  if (profile) {
    const { data: cohortMember } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", profile.id)
      .limit(1)
      .single();

    if (cohortMember) {
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("template_id")
        .eq("id", cohortMember.cohort_id)
        .single();

      if (cohort?.template_id) {
        templateId = cohort.template_id;
      }
    }
  }

  // Fetch skill groups for the template
  const { data: skillGroups } = await supabase
    .from("template_skill_groups")
    .select("id, name")
    .eq("template_id", templateId)
    .order("name");

  // Look up user's latest submitted assessment
  let hasResults = false;
  const scoresByGroupId: Record<
    string,
    { total: number; count: number; totalPossible: number }
  > = {};

  if (profile) {
    const { data: assessment } = await supabase
      .from("assessments")
      .select("id")
      .eq("user_id", profile.id)
      .eq("template_id", templateId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single();

    if (assessment) {
      hasResults = true;

      // Fetch skill scores joined with template_skills to get skill_group_id
      const { data: skillScores } = await supabase
        .from("assessment_skill_scores")
        .select(
          "final_score, template_skill_id, template_skills(skill_group_id, max_points)"
        )
        .eq("assessment_id", assessment.id);

      if (skillScores) {
        for (const ss of skillScores) {
          const skill = ss.template_skills as unknown as {
            skill_group_id: string;
            max_points: number;
          };
          const groupId = skill?.skill_group_id;
          if (!groupId || ss.final_score == null) continue;

          if (!scoresByGroupId[groupId]) {
            scoresByGroupId[groupId] = { total: 0, count: 0, totalPossible: 0 };
          }
          scoresByGroupId[groupId].total += Number(ss.final_score);
          scoresByGroupId[groupId].count += 1;
          scoresByGroupId[groupId].totalPossible += skill.max_points ?? 0;
        }
      }
    }
  }

  // Build chart data: skill group names with percentage scores
  const chartData = (skillGroups ?? []).map((sg) => {
    const agg = scoresByGroupId[sg.id];
    return {
      name: sg.name,
      score:
        agg && agg.totalPossible > 0
          ? Math.round((agg.total / agg.totalPossible) * 100)
          : 0,
    };
  });

  // Build scores-by-category data with per-group percentage scores
  const skillGroupsWithScores = (skillGroups ?? []).map((sg) => {
    const agg = scoresByGroupId[sg.id];
    return {
      ...sg,
      score:
        agg && agg.totalPossible > 0
          ? Math.round((agg.total / agg.totalPossible) * 100)
          : 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top row: Results + Learning Paths */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <ResultsAtAGlance data={chartData} hasResults={hasResults} />
        <LearningPaths />
      </div>

      {/* Bottom row: Scores, Questionnaire, Webinars */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ScoresByCategory skillGroups={skillGroupsWithScores} hasResults={hasResults} />
        <StartQuestionnaire />
        <UpcomingWebinars />
      </div>
    </div>
  );
}
