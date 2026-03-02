"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResultsAtAGlance } from "@/components/dashboard/results-at-a-glance";
import { ScoresByCategory } from "@/components/dashboard/scores-by-category";
interface SkillGroupData {
  id: string;
  name: string;
  score: number;
}

interface CorpDashboardContentProps {
  hasResults: boolean;
  scoreData: SkillGroupData[];
  completionData: SkillGroupData[];
  reviewersEnabled: boolean;
  reviewerCount: number;
  userCount: number;
  completionCount: number;
  insightsSlot: React.ReactNode;
}

export function CorpDashboardContent({
  hasResults,
  scoreData,
  completionData,
  reviewersEnabled,
  reviewerCount,
  userCount,
  completionCount,
  insightsSlot,
}: CorpDashboardContentProps) {
  const [viewMode, setViewMode] = useState<"scores" | "completion">("scores");

  const activeData = viewMode === "scores" ? scoreData : completionData;
  const chartData = activeData.map(({ name, score }) => ({ name, score }));

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <ResultsAtAGlance data={chartData} hasResults={hasResults} />

        {insightsSlot}
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

      <div className="grid gap-6 lg:grid-cols-4">
        <ScoresByCategory skillGroups={activeData} hasResults={hasResults} />

        <Card>
          <CardHeader>
            <CardTitle>Assessment Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-base text-[#004070]">Active Assessment: Core Competency 2025</p>
            <p className="text-base text-[#004070]">Participants: {completionCount} / {userCount} submitted</p>
            <div className="space-y-3">
              <Button variant="outline" className="w-40 border-[#00ABEB] text-[#004070]">Roster</Button>
              <Button className="w-40 bg-[#004070] text-white hover:bg-[#003560]">Reminders</Button>
              <Button variant="outline" className="w-40 border-[#00ABEB] text-[#004070]">Details</Button>
            </div>
          </CardContent>
        </Card>

        {reviewersEnabled && (
          <Card>
            <CardHeader>
              <CardTitle>Reviewers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-base text-[#004070]">Reviewers: {reviewerCount}</p>
              <p className="text-base text-[#004070]">Avg difference between scores: +8%</p>
              <div className="space-y-3">
                <Button className="w-40 bg-[#004070] text-white hover:bg-[#003560]">View Progress</Button>
                <Button variant="outline" className="w-40 border-[#00ABEB] text-[#004070]">Manage</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Report & Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#004070]">Feedback preview will appear here.</p>
            <ol className="list-decimal space-y-2 pl-6 text-sm text-[#004070]">
              <li>The View button will show a full-screen version with all written feedback.</li>
              <li>The text shown here will be a preview.</li>
            </ol>
            <p className="text-right text-sm font-medium text-[#004070]">View</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
