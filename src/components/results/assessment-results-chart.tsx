"use client";

import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import type { BenchmarkData } from "./use-benchmarks";

export interface SkillGroupResult {
  id: string;
  name: string;
  userScore: number;
  totalPossible: number;
}

interface ChartDatum {
  id: string;
  name: string;
  you: number;
  benchmark: number;
  reviewerScore?: number;
  totalPossible: number;
}

function PointsTooltip({
  active,
  payload,
  label,
  chartConfig,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string | (number | string)[]; color?: string }[];
  label?: string;
  chartConfig: ChartConfig;
}) {
  if (!active || !payload?.length) return null;
  const totalPossible = (payload[0] as { payload?: ChartDatum })?.payload?.totalPossible ?? 0;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-[#004070]">{label}</p>
      {payload.map((entry) => {
        const config = chartConfig[entry.dataKey as keyof typeof chartConfig];
        return (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{config?.label ?? entry.dataKey}:</span>
            <span className="font-medium">{entry.value} / {totalPossible} pts</span>
          </div>
        );
      })}
    </div>
  );
}

const baseChartConfig = {
  you: {
    label: "You",
    color: "#004070",
  },
  benchmark: {
    label: "Benchmark",
    color: "#00ABEB",
  },
} satisfies ChartConfig;

const reviewerChartConfig = {
  ...baseChartConfig,
  reviewerScore: {
    label: "Reviewer",
    color: "#0070B8",
  },
} satisfies ChartConfig;

export function AssessmentResultsChart({
  skillGroups,
  templateId,
  hasResults,
  filters,
  onSelectGroup,
  benchmarks,
  keyBarSlot,
  filterSlot,
  reviewerScores,
  showReviewerScores,
  emptyStateMessage,
  subjectLabel = "You",
  percentageBasedScoring = true,
}: {
  skillGroups: SkillGroupResult[];
  templateId: string;
  hasResults: boolean;
  filters: Record<string, string>;
  onSelectGroup: (groupId: string) => void;
  benchmarks: Record<string, BenchmarkData>;
  keyBarSlot?: React.ReactNode;
  filterSlot?: React.ReactNode;
  reviewerScores?: Record<string, number>;
  showReviewerScores?: boolean;
  emptyStateMessage?: string;
  subjectLabel?: string;
  percentageBasedScoring?: boolean;
}) {
  if (!hasResults) {
    return (
      <Card>
        <CardContent className="py-8">
          <h2 className="text-center text-lg font-semibold text-[#004070]">
            Assessment Results
          </h2>
          <div className="mt-6 flex h-48 items-center justify-center text-sm text-muted-foreground">
            {emptyStateMessage ?? "Complete your first assessment to see your results here."}
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData: ChartDatum[] = skillGroups.map((sg) => {
    const bm = benchmarks[sg.id];
    let you: number;
    let benchmark: number;

    if (percentageBasedScoring) {
      you = sg.totalPossible > 0 ? Math.round((sg.userScore / sg.totalPossible) * 100) : 0;
      benchmark =
        bm?.mean_score != null && bm?.total_possible_points
          ? Math.round((Number(bm.mean_score) / Number(bm.total_possible_points)) * 100)
          : 0;
    } else {
      you = Math.round(sg.userScore);
      benchmark = bm?.mean_score != null ? Math.round(Number(bm.mean_score)) : 0;
    }

    return {
      id: sg.id,
      name: sg.name,
      you,
      benchmark,
      reviewerScore: reviewerScores?.[sg.id] ?? 0,
      totalPossible: sg.totalPossible,
    };
  });

  const yAxisDomain: [number, number] = percentageBasedScoring
    ? [0, 100]
    : [0, Math.max(1, ...skillGroups.map((sg) => sg.totalPossible))];

  const chartConfig = {
    ...(showReviewerScores ? reviewerChartConfig : baseChartConfig),
    you: {
      ...(showReviewerScores ? reviewerChartConfig.you : baseChartConfig.you),
      label: subjectLabel,
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardContent className="py-8">
        <div className="flex items-center justify-between">
          <div />
          <h2 className="text-lg font-semibold text-[#004070]">
            Assessment Results
          </h2>
          <button
            className="rounded-full border border-[#00ABEB] p-2 text-[#00ABEB] transition-colors hover:bg-[#00ABEB]/5"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>

        <ChartContainer config={chartConfig} className="mt-6 h-64 w-full">
          <BarChart data={chartData} accessibilityLayer barGap={2}>
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={0}
              tick={{ fill: "#004070" }}
            />
            <YAxis hide domain={yAxisDomain} />
            <ChartTooltip
              content={
                percentageBasedScoring
                  ? <ChartTooltipContent valueSuffix="%" />
                  : (props) => <PointsTooltip {...props} chartConfig={chartConfig} />
              }
            />
            <Bar
              dataKey="you"
              fill="var(--color-you)"
              radius={[4, 4, 0, 0]}
              onClick={(data) => onSelectGroup(data.payload.id)}
              className="cursor-pointer"
            />
            <Bar
              dataKey="benchmark"
              fill="var(--color-benchmark)"
              radius={[4, 4, 0, 0]}
              onClick={(data) => onSelectGroup(data.payload.id)}
              className="cursor-pointer"
            />
            {showReviewerScores && (
              <Bar
                dataKey="reviewerScore"
                fill="var(--color-reviewerScore)"
                radius={[4, 4, 0, 0]}
                onClick={(data) => onSelectGroup(data.payload.id)}
                className="cursor-pointer"
              />
            )}
          </BarChart>
        </ChartContainer>

        {/* Percentages row */}
        <div className="mt-2 flex">
          {chartData.map((d) => {
            const diff = d.you - d.benchmark;
            return (
              <div key={d.name} className="flex-1 text-center">
                <span
                  className={`text-xs font-semibold ${
                    diff >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {diff >= 0 ? "+" : ""}{diff}{percentageBasedScoring ? "%" : " pts"}{" "}
                  {diff >= 0 ? "\u2197" : "\u2198"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Key */}
        {keyBarSlot ?? (
          <div className="mt-4 inline-flex items-center gap-4 rounded-lg border px-4 py-2 text-xs">
            <span className="font-medium text-muted-foreground">Key</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#004070]" />
              {subjectLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#00ABEB]" />
              Benchmark
            </span>
          </div>
        )}

        {filterSlot && (
          <div className="mt-6 border-t pt-6">
            <div className="flex items-end gap-2">
              <span className="shrink-0 pb-2 text-xs font-semibold text-[#004070]">
                Cohort Filters
              </span>
              <div className="flex flex-1 justify-center">
                {filterSlot}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
