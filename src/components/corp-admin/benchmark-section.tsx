import { db } from "@/lib/db";
import { BenchmarkContent, type InsightData, type SkillGroupData } from "./benchmark-content";

interface BenchmarkRow {
  mean_score: number | null;
  total_possible_points: number | null;
  n: number | null;
}

function benchmarkPercent(row: BenchmarkRow | undefined): number | null {
  if (!row) return null;
  const total = Number(row.total_possible_points ?? 0);
  return total > 0 ? (Number(row.mean_score ?? 0) / total) * 100 : null;
}

interface BenchmarkSectionProps {
  cohortId: string;
  corporationId: string;
  templateId: string;
  industryUuid: string | null;
  participantCount: number;
  skillGroups: { id: string; name: string }[];
  reviewersEnabled: boolean;
}

export async function BenchmarkSection({
  cohortId,
  corporationId,
  templateId,
  industryUuid,
  participantCount,
  skillGroups,
  reviewersEnabled,
}: BenchmarkSectionProps) {
  const supabase = db();

  const corpBenchmarks: Record<string, BenchmarkRow> = {};
  const globalBenchmarks: Record<string, BenchmarkRow> = {};
  const industryBenchmarks: Record<string, BenchmarkRow> = {};

  // Fetch industry label + all benchmark RPCs in parallel
  const [industryLabelResult] = await Promise.all([
    industryUuid
      ? supabase.from("industries").select("label").eq("id", industryUuid).maybeSingle()
      : Promise.resolve({ data: null }),
    ...skillGroups.flatMap((group) => {
      const baseArgs = {
        p_template_id: templateId,
        p_skill_group_id: group.id,
        p_submitted_year: null as number | null,
        p_country: null as string | null,
        p_industry: null as string | null,
        p_job_level: null as string | null,
        p_functional_area: null as string | null,
        p_role: null as string | null,
        p_region: null as string | null,
        p_sub_region: null as string | null,
        p_years_experience: null as string | null,
        p_education_level: null as string | null,
      };

      return [
        (async () => {
          const { data } = await supabase.rpc("rpc_corporate_skill_group_benchmark", {
            p_corporation_id: corporationId,
            p_cohort_id: cohortId,
            ...baseArgs,
          });
          const row = (data?.[0] ?? null) as BenchmarkRow | null;
          if (row) corpBenchmarks[group.id] = row;
        })(),
        (async () => {
          const { data } = await supabase.rpc("rpc_skill_group_benchmark", baseArgs);
          const row = (data?.[0] ?? null) as BenchmarkRow | null;
          if (row) globalBenchmarks[group.id] = row;
        })(),
      ];
    }),
  ]);

  const industryLabel = industryLabelResult.data?.label ?? null;

  // Industry benchmarks need the label — run after the label resolves
  if (industryLabel) {
    await Promise.all(
      skillGroups.map(async (group) => {
        const { data } = await supabase.rpc("rpc_skill_group_benchmark", {
          p_template_id: templateId,
          p_skill_group_id: group.id,
          p_submitted_year: null,
          p_country: null,
          p_industry: industryLabel,
          p_job_level: null,
          p_functional_area: null,
          p_role: null,
          p_region: null,
          p_sub_region: null,
          p_years_experience: null,
          p_education_level: null,
        });
        const row = (data?.[0] ?? null) as BenchmarkRow | null;
        if (row) industryBenchmarks[group.id] = row;
      })
    );
  }

  const skillGroupsWithScores: SkillGroupData[] = skillGroups.map((sg) => {
    const b = corpBenchmarks[sg.id];
    const mean = Number(b?.mean_score ?? 0);
    const total = Number(b?.total_possible_points ?? 0);
    return { id: sg.id, name: sg.name, score: total > 0 ? Math.round((mean / total) * 100) : 0 };
  });

  const completionData: SkillGroupData[] = skillGroups.map((sg) => {
    const n = Number(corpBenchmarks[sg.id]?.n ?? 0);
    return {
      id: sg.id,
      name: sg.name,
      score: participantCount > 0 ? Math.round((n / participantCount) * 100) : 0,
    };
  });

  const hasResults = skillGroupsWithScores.some((d) => d.score > 0);

  const insights: InsightData = (() => {
    if (!hasResults) {
      return { topStrength: "—", areaForDevelopment: "—", lowestVsIndustry: null };
    }

    let topStrength: { name: string; score: number; diff: number } | null = null;
    let areaForDev: { name: string; score: number; diff: number } | null = null;
    let lowestVsIndustry: { name: string; diff: number } | null = null;

    for (const sg of skillGroupsWithScores) {
      const globalScore = benchmarkPercent(globalBenchmarks[sg.id]);

      if (globalScore !== null) {
        const diff = sg.score - globalScore;
        if (topStrength === null || diff > topStrength.diff)
          topStrength = { name: sg.name, score: sg.score, diff };
        if (areaForDev === null || diff < areaForDev.diff)
          areaForDev = { name: sg.name, score: sg.score, diff };
      }

      if (industryLabel) {
        const industryScore = benchmarkPercent(industryBenchmarks[sg.id]);
        if (industryScore !== null) {
          const diff = sg.score - industryScore;
          if (lowestVsIndustry === null || diff < lowestVsIndustry.diff)
            lowestVsIndustry = { name: sg.name, diff };
        }
      }
    }

    return {
      topStrength: topStrength
        ? `${topStrength.name} (avg. ${Math.round(topStrength.score)})`
        : "—",
      areaForDevelopment: areaForDev
        ? `${areaForDev.name} (avg. ${Math.round(areaForDev.score)})`
        : "—",
      lowestVsIndustry: lowestVsIndustry
        ? `${lowestVsIndustry.name} (${Math.round(lowestVsIndustry.diff)} pts vs industry avg.)`
        : null,
    };
  })();

  return (
    <BenchmarkContent
      hasResults={hasResults}
      scoreData={skillGroupsWithScores}
      completionData={completionData}
      insights={insights}
      reviewersEnabled={reviewersEnabled}
    />
  );
}
