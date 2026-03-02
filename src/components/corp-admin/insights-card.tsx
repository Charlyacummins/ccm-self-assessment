import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface BenchmarkRow {
  mean_score: number | null;
  total_possible_points: number | null;
}

function benchmarkPercent(row: BenchmarkRow | undefined): number | null {
  if (!row) return null;
  const total = Number(row.total_possible_points ?? 0);
  return total > 0 ? (Number(row.mean_score ?? 0) / total) * 100 : null;
}

interface InsightsCardProps {
  skillGroupsWithScores: { id: string; name: string; score: number }[];
  templateId: string;
  industryUuid: string | null;
}

export async function InsightsCard({
  skillGroupsWithScores,
  templateId,
  industryUuid,
}: InsightsCardProps) {
  const supabase = db();

  const globalBenchmarks: Record<string, BenchmarkRow> = {};
  const industryBenchmarks: Record<string, BenchmarkRow> = {};

  // Look up industry label and fetch global benchmarks in parallel
  const [industryLabelResult] = await Promise.all([
    industryUuid
      ? supabase.from("industries").select("label").eq("id", industryUuid).maybeSingle()
      : Promise.resolve({ data: null }),
    ...skillGroupsWithScores.map(async (sg) => {
      const { data } = await supabase.rpc("rpc_skill_group_benchmark", {
        p_template_id: templateId,
        p_skill_group_id: sg.id,
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
      });
      const row = (data?.[0] ?? null) as BenchmarkRow | null;
      if (row) globalBenchmarks[sg.id] = row;
    }),
  ]);

  const industryLabel = industryLabelResult.data?.label ?? null;

  if (industryLabel) {
    await Promise.all(
      skillGroupsWithScores.map(async (sg) => {
        const { data } = await supabase.rpc("rpc_skill_group_benchmark", {
          p_template_id: templateId,
          p_skill_group_id: sg.id,
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
        if (row) industryBenchmarks[sg.id] = row;
      })
    );
  }

  // Compute insights
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

  const rows: [string, string][] = [
    ["Top Strength", topStrength ? `${topStrength.name} (avg. ${Math.round(topStrength.score)})` : "—"],
    ["Area for Development", areaForDev ? `${areaForDev.name} (avg. ${Math.round(areaForDev.score)})` : "—"],
    ...(lowestVsIndustry
      ? [[
          "Lowest-scoring section vs. industry benchmark",
          `${lowestVsIndustry.name} (${Math.round(lowestVsIndustry.diff)} pts vs industry avg.)`,
        ] as [string, string]]
      : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights and Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableBody>
            {rows.map(([label, value], idx) => (
              <TableRow key={label} className={idx % 2 === 0 ? "bg-[#F3F4F6]" : ""}>
                <TableCell className="font-semibold text-[#004070]">{label}</TableCell>
                <TableCell>{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="rounded-md border bg-[#F8FAFC] p-6 text-center text-sm text-[#534F4F]">
          Insights are based on the company&apos;s aggregate results.
        </div>
      </CardContent>
    </Card>
  );
}
