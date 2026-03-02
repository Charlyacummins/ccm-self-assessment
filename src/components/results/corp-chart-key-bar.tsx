"use client";

import { Eye, EyeOff } from "lucide-react";

interface CorpChartKeyBarProps {
  benchmarkType: "global" | "corporate";
  onBenchmarkTypeChange: (type: "global" | "corporate") => void;
  showReviewerScores: boolean;
  onToggleReviewerScores: (show: boolean) => void;
}

export function CorpChartKeyBar({
  benchmarkType,
  onBenchmarkTypeChange,
  showReviewerScores,
  onToggleReviewerScores,
}: CorpChartKeyBarProps) {
  return (
    <div className="mt-4 space-y-3">
      {/* Row 1: Key legend + Reviewer scores */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 rounded-lg border px-4 py-2 text-xs">
          <span className="font-medium text-muted-foreground">Key</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-[#004070]" />
            You
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

      {/* Row 2: Benchmark type toggle (centered) */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => onBenchmarkTypeChange("global")}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium text-[#004070] transition-colors ${
              benchmarkType === "global"
                ? "bg-white shadow-sm"
                : "hover:bg-gray-200"
            }`}
          >
            Global Benchmarks
          </button>
          <button
            onClick={() => onBenchmarkTypeChange("corporate")}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium text-[#004070] transition-colors ${
              benchmarkType === "corporate"
                ? "bg-white shadow-sm"
                : "hover:bg-gray-200"
            }`}
          >
            Corporate Benchmarks
          </button>
        </div>
      </div>
    </div>
  );
}
