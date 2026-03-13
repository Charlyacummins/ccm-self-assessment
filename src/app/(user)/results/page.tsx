import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ResultsPage } from "@/components/results/results-page";
import { CorpResultsPage } from "@/components/results/corp-results-page";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";

export default async function Results() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  // Resolve template_id and corporation
  let templateId = DEFAULT_TEMPLATE_ID;
  let corporationId: string | null = null;
  let cohortId: string | null = null;
  if (profile) {
    const { data: cohortMember } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", profile.id)
      .limit(1)
      .single();

    if (cohortMember) {
      cohortId = cohortMember.cohort_id;
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("template_id, company_id")
        .eq("id", cohortMember.cohort_id)
        .single();

      if (cohort?.template_id) {
        templateId = cohort.template_id;
      }
      if (cohort?.company_id) {
        corporationId = cohort.company_id;
      }
    }
  }

  const { data: templateSkills } = await supabase
    .from("template_skills")
    .select("skill_group_id")
    .contains("meta_json", { template_ids: [templateId] });

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

  // Get user's latest submitted assessment
  let hasResults = false;
  const scoresByGroupId: Record<
    string,
    { total: number; count: number; totalPossible: number }
  > = {};
  const skillScores: {
    name: string;
    groupId: string;
    templateSkillId: string;
    maxPoints: number;
    rawScore: number;
  }[] = [];

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

      // Fetch scores with skill info
      const { data: scores } = await supabase
        .from("assessment_skill_scores")
        .select(
          "final_score, template_skill_id, template_skills(name, skill_group_id, max_points)"
        )
        .eq("assessment_id", assessment.id);

      if (scores) {
        for (const ss of scores) {
          const skill = ss.template_skills as unknown as {
            name: string;
            skill_group_id: string;
            max_points: number;
          };
          if (!skill?.skill_group_id || ss.final_score == null) continue;

          const gid = skill.skill_group_id;
          if (!scoresByGroupId[gid]) {
            scoresByGroupId[gid] = { total: 0, count: 0, totalPossible: 0 };
          }
          scoresByGroupId[gid].total += Number(ss.final_score);
          scoresByGroupId[gid].count += 1;
          scoresByGroupId[gid].totalPossible += skill.max_points ?? 0;

          skillScores.push({
            name: skill.name,
            groupId: gid,
            templateSkillId: ss.template_skill_id,
            maxPoints: skill.max_points ?? 0,
            rawScore: Number(ss.final_score),
          });
        }
      }
    }
  }

  // Build skill group data for chart
  const skillGroupResults = (skillGroups ?? []).map((sg) => {
    const agg = scoresByGroupId[sg.id];
    return {
      id: sg.id,
      name: sg.name,
      userScore: agg?.total ?? 0,
      totalPossible: agg?.totalPossible ?? 0,
    };
  });

  // Feedback text (placeholder until reviewer feedback is built)
  const feedbackText = "";

  let percentageBasedScoring = true;
  let initialFilters: Record<string, string> | undefined;

  if (profile) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("percentage_based_scoring, benchmark_default, country_id")
      .eq("user_id", profile.id)
      .maybeSingle();

    percentageBasedScoring = settings?.percentage_based_scoring ?? true;

    if (settings?.benchmark_default === "country" && settings?.country_id) {
      const { data: country } = await supabase
        .from("countries")
        .select("country_name")
        .eq("country_id", settings.country_id)
        .maybeSingle();
      if (country?.country_name) {
        initialFilters = { country: country.country_name };
      }
    }
  }

  if (corporationId && cohortId) {
    return (
      <CorpResultsPage
        hasResults={hasResults}
        templateId={templateId}
        corporationId={corporationId}
        cohortId={cohortId}
        skillGroupResults={skillGroupResults}
        skillScores={skillScores}
        feedbackText={feedbackText}
        percentageBasedScoring={percentageBasedScoring}
        initialFilters={initialFilters}
      />
    );
  }

  return (
    <ResultsPage
      hasResults={hasResults}
      templateId={templateId}
      skillGroupResults={skillGroupResults}
      skillScores={skillScores}
      feedbackText={feedbackText}
      percentageBasedScoring={percentageBasedScoring}
      initialFilters={initialFilters}
    />
  );
}
