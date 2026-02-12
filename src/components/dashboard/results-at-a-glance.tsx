"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";

export interface SkillGroupScore {
  name: string;
  score: number;
}

const chartConfig = {
  score: {
    label: "Score",
    color: "#00ABEB",
  },
} satisfies ChartConfig;

type ChartMode = "line" | "radar";

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
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill="#004070"
      fontSize={12}
    >
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? dyStart : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

export function ResultsAtAGlance({
  data,
  hasResults,
}: {
  data: SkillGroupScore[];
  hasResults: boolean;
}) {
  const [mode, setMode] = useState<ChartMode>("line");
  const isRadar = mode === "radar";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results at a glance</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasResults ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Complete your first assessment to see your results here.
          </div>
        ) : (
          <>
            <div className={`-mx-6 px-6 ${isRadar ? "overflow-x-hidden" : "overflow-x-auto"}`}>
              <div
                className="min-w-full"
                style={isRadar ? undefined : {
                  width: `${Math.max(100, (data.length / 4) * 100)}%`,
                }}
              >
                <ChartContainer config={chartConfig} className="h-48 w-full">
                  {mode === "line" ? (
                    <LineChart
                      data={data}
                      accessibilityLayer
                      margin={{ left: 16, right: 16 }}
                    >
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        interval={0}
                        tickMargin={16}
                        height={60}
                        padding={{ left: 28, right: 28 }}
                        tick={<AxisTick />}
                      />
                      <YAxis hide domain={[0, 100]} />
                      <ChartTooltip content={<ChartTooltipContent valueSuffix="%" />} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--color-score)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  ) : (
                    <RadarChart
                      data={data}
                      accessibilityLayer
                      margin={{ top: 8, right: 32, bottom: 8, left: 32 }}
                    >
                      <PolarGrid />
                      <PolarAngleAxis
                        dataKey="name"
                        tick={{ fill: "#004070", fontSize: 11 }}
                      />
                      <ChartTooltip content={<ChartTooltipContent valueSuffix="%" />} />
                      <Radar
                        dataKey="score"
                        stroke="var(--color-score)"
                        fill="var(--color-score)"
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  )}
                </ChartContainer>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setMode("line")}
                className={`rounded-full border px-4 py-1 text-sm font-medium transition-colors ${
                  mode === "line"
                    ? "border-[#004070] text-[#004070]"
                    : "text-muted-foreground"
                }`}
              >
                Line
              </button>
              <button
                onClick={() => setMode("radar")}
                className={`rounded-full border px-4 py-1 text-sm font-medium transition-colors ${
                  mode === "radar"
                    ? "border-[#004070] text-[#004070]"
                    : "text-muted-foreground"
                }`}
              >
                Radar
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
