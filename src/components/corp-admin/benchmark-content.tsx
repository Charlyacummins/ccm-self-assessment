"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ResultsAtAGlance } from "@/components/dashboard/results-at-a-glance";
import { ScoresByCategory } from "@/components/dashboard/scores-by-category";

export interface InsightData {
  topStrength: string;
  areaForDevelopment: string;
  lowestVsIndustry: string | null;
}

export interface SkillGroupData {
  id: string;
  name: string;
  score: number;
}

interface BenchmarkContentProps {
  hasResults: boolean;
  scoreData: SkillGroupData[];
  completionData: SkillGroupData[];
  insights: InsightData;
  reviewersEnabled: boolean;
}

export function BenchmarkContent({
  hasResults,
  scoreData,
  completionData,
  insights,
  reviewersEnabled,
}: BenchmarkContentProps) {
  const [viewMode, setViewMode] = useState<"scores" | "completion">("scores");

  const activeData = viewMode === "scores" ? scoreData : completionData;
  const chartData = activeData.map(({ name, score }) => ({ name, score }));

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <ResultsAtAGlance data={chartData} hasResults={hasResults} />

        <Card>
          <CardHeader>
            <CardTitle>Insights and Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                {(
                  [
                    ["Top Strength", insights.topStrength],
                    ["Area for Development", insights.areaForDevelopment],
                    ...(insights.lowestVsIndustry
                      ? [
                          [
                            "Lowest-scoring section vs. industry benchmark",
                            insights.lowestVsIndustry,
                          ] as const,
                        ]
                      : []),
                  ] as [string, string][]
                ).map(([label, value], idx) => (
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
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4 rounded-lg border px-4 py-2 text-xs">
          <span className="font-medium text-muted-foreground">Key</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-[#004070]" />
            User
          </span>
          {reviewersEnabled && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#00ABEB]" />
              Reviewer
            </span>
          )}
        </div>
        <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setViewMode("scores")}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium text-[#004070] transition-colors ${
              viewMode === "scores" ? "bg-white shadow-sm" : "hover:bg-gray-200"
            }`}
          >
            Scores
          </button>
          <button
            onClick={() => setViewMode("completion")}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium text-[#004070] transition-colors ${
              viewMode === "completion" ? "bg-white shadow-sm" : "hover:bg-gray-200"
            }`}
          >
            Completion
          </button>
        </div>
      </div>

      <ScoresByCategory skillGroups={activeData} hasResults={hasResults} />
    </>
  );
}
