"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import type { SkillGroupResult } from "./assessment-results-chart";
import type { BenchmarkData } from "./use-benchmarks";

interface ChartDatum {
  name: string;
  you: number;
  benchmark: number;
}

const chartConfig = {
  you: {
    label: "You",
    color: "#004070",
  },
  benchmark: {
    label: "Benchmark",
    color: "#00ABEB",
  },
} satisfies ChartConfig;

export function AssessmentFeedback({
  hasResults,
  skillGroups,
  templateId,
  filters,
  feedbackText,
  benchmarks,
}: {
  hasResults: boolean;
  skillGroups: SkillGroupResult[];
  templateId: string;
  filters: Record<string, string>;
  feedbackText: string;
  benchmarks: Record<string, BenchmarkData>;
}) {
  const chartData: ChartDatum[] = skillGroups.map((sg) => {
    const bm = benchmarks[sg.id];
    const userPct =
      sg.totalPossible > 0
        ? Math.round((sg.userScore / sg.totalPossible) * 100)
        : 0;
    const bmPct =
      bm?.mean_score != null && bm?.total_possible_points
        ? Math.round(
            (Number(bm.mean_score) / Number(bm.total_possible_points)) * 100
          )
        : 0;
    return {
      name: sg.name,
      you: userPct,
      benchmark: bmPct,
    };
  });

  return (
    <Card>
      <CardContent className="py-8">
        <h2 className="mb-6 text-lg font-semibold text-[#004070]">
          Assessment Feedback
        </h2>

        {!hasResults ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Complete your first assessment to see feedback here.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Feedback text */}
            <div>
              <p className="text-sm text-gray-600 line-clamp-4">
                {feedbackText ||
                  "Your assessment feedback will appear here once reviewed."}
              </p>
              <button className="mt-4 rounded-full bg-[#004070] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003060]">
                View
              </button>
            </div>

            {/* Skill group line chart with benchmark */}
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <LineChart data={chartData} accessibilityLayer>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval={0}
                  tick={{ fill: "#004070" }}
                />
                <YAxis hide domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent valueSuffix="%" />} />
                <Line
                  type="monotone"
                  dataKey="you"
                  stroke="var(--color-you)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="var(--color-benchmark)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
