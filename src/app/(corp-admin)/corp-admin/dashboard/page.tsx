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
        .select("id, skill_group_id, max_points")
        .contains("meta_json", { template_ids: [templateId] })
    : { data: [] as Array<{ id: string; skill_group_id: string | null; max_points: number | null }> };

  const skillGroupIds = [
    ...new Set(
      (templateSkills ?? [])
        .map((row) => row.skill_group_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const [skillGroupsResult, totalMembersResult, reviewerCountResult, settingsResult, memberUserIdsResult] =
    await Promise.all([
      skillGroupIds.length
        ? supabase.from("template_skill_groups").select("id, name").in("id", skillGroupIds).order("name")
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      cohortId
        ? supabase.from("cohort_members").select("*", { count: "exact", head: true }).eq("cohort_id", cohortId)
        : Promise.resolve({ count: 0 }),
      cohortId
        ? supabase.from("cohort_members").select("*", { count: "exact", head: true }).eq("cohort_id", cohortId).eq("role", "reviewer")
        : Promise.resolve({ count: 0 }),
      cohortId
        ? supabase.from("cohort_settings").select("reviewers_enabled").eq("cohort_id", cohortId).maybeSingle()
        : Promise.resolve({ data: null }),
      cohortId
        ? supabase.from("cohort_members").select("user_id").eq("cohort_id", cohortId).eq("role", "user")
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);

  const skillGroups = skillGroupsResult.data ?? [];
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

  // Compute cohort group averages using the same logic as cohort-results route
  const skillGroupsWithScores: { id: string; name: string; score: number }[] = skillGroups.map(
    (sg) => ({ id: sg.id, name: sg.name, score: 0 })
  );

  if (memberUserIds.length > 0 && (templateSkills ?? []).length > 0) {
    const referenceTemplateSkillIds = (templateSkills ?? [])
      .map((ts) => ts.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const { data: assessments } = await supabase
      .from("assessments")
      .select("id")
      .in("user_id", memberUserIds)
      .in("status", ["submitted", "in_review", "reviewed", "completed"]);

    const assessmentIds = (assessments ?? []).map((a) => a.id).filter(Boolean);

    if (assessmentIds.length > 0 && referenceTemplateSkillIds.length > 0) {
      const { data: scoreRows } = await supabase
        .from("assessment_skill_scores")
        .select("assessment_id, reviewer_score, final_score, points, template_skill_id")
        .in("assessment_id", assessmentIds)
        .in("template_skill_id", referenceTemplateSkillIds);

      // Build skill → group_id + max_points lookup
      const skillMeta = new Map<string, { groupId: string; maxPoints: number }>();
      for (const ts of templateSkills ?? []) {
        if (ts.skill_group_id && ts.id) {
          skillMeta.set(ts.id, { groupId: ts.skill_group_id, maxPoints: Number(ts.max_points ?? 0) });
        }
      }

      // groupPossible: sum of max_points per group
      const groupPossible = new Map<string, number>();
      for (const ts of templateSkills ?? []) {
        if (!ts.skill_group_id) continue;
        groupPossible.set(ts.skill_group_id, (groupPossible.get(ts.skill_group_id) ?? 0) + Number(ts.max_points ?? 0));
      }

      // Aggregate per skill
      const skillAgg = new Map<string, { groupId: string; total: number; assessmentIds: Set<string> }>();
      for (const row of scoreRows ?? []) {
        const scoreValue = (row as Record<string, unknown>).reviewer_score ?? (row as Record<string, unknown>).final_score ?? (row as Record<string, unknown>).points;
        const finalScore = Number(scoreValue);
        if (!Number.isFinite(finalScore)) continue;
        const assessmentId = typeof (row as Record<string, unknown>).assessment_id === "string" ? (row as Record<string, unknown>).assessment_id as string : null;
        const templateSkillId = typeof (row as Record<string, unknown>).template_skill_id === "string" ? (row as Record<string, unknown>).template_skill_id as string : null;
        if (!assessmentId || !templateSkillId) continue;
        const meta = skillMeta.get(templateSkillId);
        if (!meta) continue;
        const current = skillAgg.get(templateSkillId) ?? { groupId: meta.groupId, total: 0, assessmentIds: new Set<string>() };
        current.total += finalScore;
        current.assessmentIds.add(assessmentId);
        skillAgg.set(templateSkillId, current);
      }

      // Compute group scores as sum of per-skill averages / totalPossible
      const groupScore = new Map<string, number>();
      for (const agg of skillAgg.values()) {
        if (agg.assessmentIds.size === 0) continue;
        const skillAvg = agg.total / agg.assessmentIds.size;
        groupScore.set(agg.groupId, (groupScore.get(agg.groupId) ?? 0) + skillAvg);
      }

      for (const sg of skillGroupsWithScores) {
        const score = groupScore.get(sg.id) ?? 0;
        const possible = groupPossible.get(sg.id) ?? 0;
        sg.score = possible > 0 ? Math.round((score / possible) * 100) : 0;
      }
    }
  }

  const participantCount = Math.max(0, totalMembers - 1);
  const completionRate = participantCount > 0 ? Math.round(((completionCount ?? 0) / participantCount) * 100) : 0;

  const completionData = skillGroups.map((sg) => ({
    id: sg.id,
    name: sg.name,
    score: completionRate,
  }));

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
