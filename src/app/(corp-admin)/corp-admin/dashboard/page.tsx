import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CorpDashboardContent } from "@/components/corp-admin/corp-dashboard-content";
import { InsightsCard } from "@/components/corp-admin/insights-card";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";

interface BenchmarkRow {
  mean_score: number | null;
  total_possible_points: number | null;
  n: number | null;
}

function InsightsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-56" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded px-2 py-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
        <Skeleton className="mt-4 h-16 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export default async function CorpAdminDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");
  const cookieStore = await cookies();
  const selectedCohortIdFromCookie =
    cookieStore.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) return null;

  const { data: corpMembership } = await supabase
    .from("corp_memberships")
    .select("corporation_id")
    .eq("user_id", profile.id)
    .eq("role", "corp_admin")
    .limit(1)
    .maybeSingle();

  const { data: cohorts } = corpMembership
    ? await supabase
        .from("cohorts")
        .select("id, template_id, industry, created_at")
        .eq("company_id", corpMembership.corporation_id)
        .eq("admin_id", profile.id)
        .order("created_at", { ascending: false })
    : {
        data: [] as {
          id: string;
          template_id: string | null;
          industry: string | null;
          created_at: string | null;
        }[],
      };

  const primaryCohort = (cohorts ?? []).find((c) => c.template_id) ?? null;
  const selectedCohort =
    (cohorts ?? []).find(
      (c) => c.id === selectedCohortIdFromCookie && c.template_id
    ) ?? null;
  const activeCohort = selectedCohort ?? primaryCohort;
  const cohortId = activeCohort?.id ?? null;
  const templateId = activeCohort?.template_id ?? null;
  const industryUuid = activeCohort?.industry ?? null;

  const { data: templateSkills } = templateId
    ? await supabase
        .from("template_skills")
        .select("skill_group_id")
        .contains("meta_json", { template_ids: [templateId] })
    : { data: [] as Array<{ skill_group_id: string | null }> };

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
    : { data: [] as { id: string; name: string }[] };

  const corpBenchmarks: Record<string, BenchmarkRow> = {};

  const [, totalMembersResult, reviewerCountResult, settingsResult, memberUserIdsResult] =
    await Promise.all([
      (async () => {
        if (
          corpMembership?.corporation_id &&
          cohortId &&
          templateId &&
          (skillGroups?.length ?? 0) > 0
        ) {
          await Promise.all(
            (skillGroups ?? []).map(async (group) => {
              const { data, error } = await supabase.rpc(
                "rpc_corporate_skill_group_benchmark",
                {
                  p_corporation_id: corpMembership.corporation_id,
                  p_cohort_id: cohortId,
                  p_template_id: templateId,
                  p_skill_group_id: group.id,
                  p_submitted_year: null,
                  p_country: null,
                  p_industry: null,
                  p_job_level: null,
                  p_functional_area: null,
                  p_role: null,
                  p_region: null,
                  p_sub_region: null,
                  p_years_experience: null,
                  p_education_level: null,
                }
              );
              if (error) return;
              const row = (data?.[0] ?? null) as BenchmarkRow | null;
              if (row) corpBenchmarks[group.id] = row;
            })
          );
        }
      })(),
      cohortId
        ? supabase
            .from("cohort_members")
            .select("*", { count: "exact", head: true })
            .eq("cohort_id", cohortId)
        : Promise.resolve({ count: 0 }),
      cohortId
        ? supabase
            .from("cohort_members")
            .select("*", { count: "exact", head: true })
            .eq("cohort_id", cohortId)
            .eq("role", "reviewer")
        : Promise.resolve({ count: 0 }),
      cohortId
        ? supabase
            .from("cohort_settings")
            .select("reviewers_enabled")
            .eq("cohort_id", cohortId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      cohortId
        ? supabase
            .from("cohort_members")
            .select("user_id")
            .eq("cohort_id", cohortId)
            .eq("role", "user")
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);

  const totalMembers = totalMembersResult.count ?? 0;
  const reviewerCount = reviewerCountResult.count ?? 0;
  const reviewersEnabled = settingsResult.data?.reviewers_enabled ?? false;

  const memberUserIds = (memberUserIdsResult.data ?? []).map((m) => m.user_id);
  const userCount = memberUserIds.length;

  const { count: completionCount } = memberUserIds.length
    ? await supabase
        .from("assessments")
        .select("*", { count: "exact", head: true })
        .in("user_id", memberUserIds)
        .in("status", ["submitted", "in_review", "reviewed", "completed"])
    : { count: 0 };

  const skillGroupsWithScores = (skillGroups ?? []).map((sg) => {
    const benchmark = corpBenchmarks[sg.id];
    const mean = Number(benchmark?.mean_score ?? 0);
    const totalPossible = Number(benchmark?.total_possible_points ?? 0);
    return {
      id: sg.id,
      name: sg.name,
      score: totalPossible > 0 ? Math.round((mean / totalPossible) * 100) : 0,
    };
  });

  const participantCount = Math.max(0, totalMembers - 1); // exclude the corp_admin

  const completionData = (skillGroups ?? []).map((sg) => {
    const benchmark = corpBenchmarks[sg.id];
    const n = Number(benchmark?.n ?? 0);
    return {
      id: sg.id,
      name: sg.name,
      score: participantCount > 0 ? Math.round((n / participantCount) * 100) : 0,
    };
  });

  const hasResults = skillGroupsWithScores.some((d) => d.score > 0);

  const insightsSlot =
    templateId ? (
      <Suspense fallback={<InsightsSkeleton />}>
        <InsightsCard
          skillGroupsWithScores={skillGroupsWithScores}
          templateId={templateId}
          industryUuid={industryUuid}
        />
      </Suspense>
    ) : (
      <InsightsSkeleton />
    );

  return (
    <section className="space-y-6">
      <CorpDashboardContent
        hasResults={hasResults}
        scoreData={skillGroupsWithScores}
        completionData={completionData}
        reviewersEnabled={reviewersEnabled}
        reviewerCount={reviewerCount}
        userCount={userCount}
        completionCount={completionCount ?? 0}
        insightsSlot={insightsSlot}
      />
    </section>
  );
}
