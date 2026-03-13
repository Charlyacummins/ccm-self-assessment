"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

function splitLabel(label: string) {
  const trimmed = label.trim();
  if (trimmed.length <= 16) return [trimmed];
  if (trimmed.includes(" / ")) {
    const [a, b] = trimmed.split(" / ");
    return [a, b ? `/${b}` : ""].filter(Boolean);
  }
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return [trimmed];

  const lines: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  const maxLine = 16;

  for (const word of words) {
    const nextLen = currentLen + (current.length ? 1 : 0) + word.length;
    if (current.length && nextLen > maxLine) {
      lines.push(current.join(" "));
      current = [word];
      currentLen = word.length;
    } else {
      current.push(word);
      currentLen = nextLen;
    }
  }

  if (current.length) lines.push(current.join(" "));
  return lines;
}

const AxisTick = ({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) => {
  const value = payload?.value ?? "";
  const lines = splitLabel(value);
  const dyStart = lines.length > 1 ? 6 : 0;

  return (
    <text x={x} y={y} textAnchor="middle" fill="#004070" fontSize={11}>
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? dyStart : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

export function AssessmentFeedback({
  hasResults,
  skillGroups,
  templateId: _templateId,
  filters: _filters,
  feedbackText,
  benchmarks,
  benchmarksLoading = false,
  emptyStateMessage,
}: {
  hasResults: boolean;
  skillGroups: SkillGroupResult[];
  templateId: string;
  filters: Record<string, string>;
  feedbackText: string;
  benchmarks: Record<string, BenchmarkData>;
  benchmarksLoading?: boolean;
  emptyStateMessage?: string;
}) {
  if (benchmarksLoading && hasResults) {
    return (
      <Card>
        <CardContent className="py-8">
          <Skeleton className="mb-6 h-5 w-44" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
              <Skeleton className="mt-4 h-9 w-24 rounded-full" />
            </div>
            <Skeleton className="h-48 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

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
            {emptyStateMessage ??
              "Complete your first assessment to see feedback here."}
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
            <div className="-mx-3 overflow-x-auto px-3">
              <div
                style={{
                  minWidth: `${Math.max(100, (chartData.length / 4) * 100)}%`,
                }}
              >
                <ChartContainer config={chartConfig} className="h-48 w-full">
                  <LineChart
                    data={chartData}
                    accessibilityLayer
                    margin={{ left: 16, right: 16 }}
                  >
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={16}
                      height={60}
                      padding={{ left: 28, right: 28 }}
                      tick={<AxisTick />}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <ChartTooltip
                      content={<ChartTooltipContent valueSuffix="%" />}
                    />
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
