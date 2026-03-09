"use client";

import { Eye, EyeOff } from "lucide-react";

interface CorpChartKeyBarProps {
  showReviewerScores: boolean;
  onToggleReviewerScores: (show: boolean) => void;
  subjectLabel?: string;
}

export function CorpChartKeyBar({
  showReviewerScores,
  onToggleReviewerScores,
  subjectLabel = "You",
}: CorpChartKeyBarProps) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 rounded-lg border px-4 py-2 text-xs">
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

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Reviewer Scores
          </span>
          <button
            onClick={() => onToggleReviewerScores(true)}
            className={`rounded p-1 transition-colors ${
              showReviewerScores
                ? "bg-[#004070] text-white"
                : "text-[#004070] hover:bg-gray-100"
            }`}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleReviewerScores(false)}
            className={`rounded p-1 transition-colors ${
              !showReviewerScores
                ? "bg-[#004070] text-white"
                : "text-[#004070] hover:bg-gray-100"
            }`}
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
