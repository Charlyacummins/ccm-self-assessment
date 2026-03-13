"use client";

import { useState } from "react";
import Link from "next/link";
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
  reviewedCount: number;
  cohortName: string | null;
  cohortStatus: string | null;
  templateTitle: string | null;
  insightsSlot: React.ReactNode;
  percentageBasedScoring?: boolean;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status?.toLowerCase();
  const cls =
    s === "active"
      ? "bg-green-100 text-green-800"
      : s === "completed"
      ? "bg-[#004070]/10 text-[#004070]"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status ?? "Draft"}
    </span>
  );
}

export function CorpDashboardContent({
  hasResults,
  scoreData,
  completionData,
  reviewersEnabled,
  reviewerCount,
  userCount,
  completionCount,
  reviewedCount,
  cohortName,
  cohortStatus,
  templateTitle,
  insightsSlot,
  percentageBasedScoring = true,
}: CorpDashboardContentProps) {
  const [viewMode, setViewMode] = useState<"scores" | "completion">("scores");

  const activeData = viewMode === "scores" ? scoreData : completionData;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <ResultsAtAGlance
          data={scoreData.map(({ name, score }) => ({ name, score }))}
          hasResults={hasResults}
        />

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
        <ScoresByCategory skillGroups={activeData} hasResults={hasResults} percentageBasedScoring={percentageBasedScoring} />

        {/* Assessment Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">Assessment Management</CardTitle>
              <StatusBadge status={cohortStatus} />
            </div>
            {cohortName && (
              <p className="text-sm font-medium text-[#004070]">{cohortName}</p>
            )}
            {templateTitle && (
              <p className="text-xs text-[#534F4F]">{templateTitle}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#534F4F]">Submitted</span>
                <span className="font-medium text-[#004070]">
                  {completionCount} / {userCount}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#004070] transition-all"
                  style={{ width: userCount > 0 ? `${Math.round((completionCount / userCount) * 100)}%` : "0%" }}
                />
              </div>
              <p className="text-right text-xs text-[#534F4F]">
                {userCount > 0 ? Math.round((completionCount / userCount) * 100) : 0}% complete
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full border-[#00ABEB] text-[#004070]" asChild>
                <Link href="/corp-admin/users">Roster</Link>
              </Button>
              <Button className="w-full bg-[#004070] text-white hover:bg-[#003560]" asChild>
                <Link href="/corp-admin/manage-assessments">Manage</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reviewers */}
        {reviewersEnabled && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reviewers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#534F4F]">Assigned</span>
                  <span className="font-medium text-[#004070]">{reviewerCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#534F4F]">Reviews complete</span>
                  <span className="font-medium text-[#004070]">
                    {reviewedCount} / {completionCount}
                  </span>
                </div>
                {completionCount > 0 && (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#00ABEB] transition-all"
                        style={{ width: `${Math.round((reviewedCount / completionCount) * 100)}%` }}
                      />
                    </div>
                    <p className="text-right text-xs text-[#534F4F]">
                      {Math.round((reviewedCount / completionCount) * 100)}% reviewed
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button className="w-full bg-[#004070] text-white hover:bg-[#003560]" asChild>
                  <Link href="/corp-admin/reviewers">Manage Reviewers</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report & Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report & Export</CardTitle>
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
