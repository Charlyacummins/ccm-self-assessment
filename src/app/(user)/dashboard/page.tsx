import { Suspense, cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ResultsAtAGlance } from "@/components/dashboard/results-at-a-glance";
import { LearningPaths } from "@/components/dashboard/learning-paths";
import { ScoresByCategory } from "@/components/dashboard/scores-by-category";
import { StartQuestionnaire } from "@/components/dashboard/start-questionnaire";
import { UpcomingWebinars } from "@/components/dashboard/upcoming-webinars";
import { AssessmentHistoryTable } from "@/components/dashboard/assessment-history-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";

// Deduplicated across concurrent server components in the same render
const fetchUserScoreData = cache(async (profileId: string, templateId: string) => {
  const supabase = db();

  let hasResults = false;
  const scoresByGroupId: Record<
    string,
    { total: number; count: number; totalPossible: number }
  > = {};

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("user_id", profileId)
    .eq("template_id", templateId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();

  if (assessment) {
    hasResults = true;

    const { data: skillScores } = await supabase
      .from("assessment_skill_scores")
      .select("final_score, template_skill_id, template_skills(skill_group_id, max_points)")
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

  return { hasResults, scoresByGroupId };
});

type SkillGroup = { id: string; name: string };

function ResultsAtAGlanceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="flex items-center justify-center py-8">
        <Skeleton className="h-48 w-48 rounded-full" />
      </CardContent>
    </Card>
  );
}

function ScoresByCategorySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function ResultsAtAGlanceServer({
  profileId,
  templateId,
  skillGroups,
}: {
  profileId: string;
  templateId: string;
  skillGroups: SkillGroup[];
}) {
  const { hasResults, scoresByGroupId } = await fetchUserScoreData(profileId, templateId);
  const chartData = skillGroups.map((sg) => {
    const agg = scoresByGroupId[sg.id];
    return {
      name: sg.name,
      score: agg && agg.totalPossible > 0 ? Math.round((agg.total / agg.totalPossible) * 100) : 0,
    };
  });
  return <ResultsAtAGlance data={chartData} hasResults={hasResults} />;
}

async function ScoresByCategoryServer({
  profileId,
  templateId,
  skillGroups,
  percentageBasedScoring,
}: {
  profileId: string;
  templateId: string;
  skillGroups: SkillGroup[];
  percentageBasedScoring: boolean;
}) {
  const { hasResults, scoresByGroupId } = await fetchUserScoreData(profileId, templateId);
  const skillGroupsWithScores = skillGroups.map((sg) => {
    const agg = scoresByGroupId[sg.id];
    return {
      ...sg,
      score: agg && agg.totalPossible > 0 ? Math.round((agg.total / agg.totalPossible) * 100) : 0,
      rawScore: agg?.total,
      maxPossible: agg?.totalPossible,
    };
  });
  return <ScoresByCategory skillGroups={skillGroupsWithScores} hasResults={hasResults} percentageBasedScoring={percentageBasedScoring} />;
}

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  let templateId = DEFAULT_TEMPLATE_ID;
  if (profile) {
    const { data: cohortMember } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", profile.id)
      .limit(1)
      .maybeSingle();

    if (cohortMember) {
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("template_id")
        .eq("id", cohortMember.cohort_id)
        .single();
      if (cohort?.template_id) templateId = cohort.template_id;
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
    : { data: [] as SkillGroup[] };

  const groups = skillGroups ?? [];

  const { data: userSettings } = profile
    ? await supabase
        .from("user_settings")
        .select("dashboard_option, percentage_based_scoring")
        .eq("user_id", profile.id)
        .maybeSingle()
    : { data: null };
  const dashboardOption = userSettings?.dashboard_option ?? "insights";
  const percentageBasedScoring = userSettings?.percentage_based_scoring ?? true;

  return (
    <div className="space-y-6">
      {/* Top row: Results at a glance + Insights/Learning Paths */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {profile ? (
          <Suspense fallback={<ResultsAtAGlanceSkeleton />}>
            <ResultsAtAGlanceServer
              profileId={profile.id}
              templateId={templateId}
              skillGroups={groups}
            />
          </Suspense>
        ) : (
          <ResultsAtAGlanceSkeleton />
        )}
        {dashboardOption === "assessments" && profile ? (
          <Suspense fallback={<ScoresByCategorySkeleton />}>
            <AssessmentHistoryTable profileId={profile.id} />
          </Suspense>
        ) : (
          <LearningPaths />
        )}
      </div>

      {/* Bottom row: Scores, Questionnaire, Webinars */}
      <div className="grid gap-6 lg:grid-cols-3">
        {profile ? (
          <Suspense fallback={<ScoresByCategorySkeleton />}>
            <ScoresByCategoryServer
              profileId={profile.id}
              templateId={templateId}
              skillGroups={groups}
              percentageBasedScoring={percentageBasedScoring}
            />
          </Suspense>
        ) : (
          <ScoresByCategorySkeleton />
        )}
        <StartQuestionnaire />
        <UpcomingWebinars />
      </div>
    </div>
  );
}
