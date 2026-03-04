"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import {
  AssessmentResultsChart,
  type SkillGroupResult,
} from "./assessment-results-chart";
import { BenchmarkOptions } from "./benchmark-options";
import { AssessmentFeedback } from "./assessment-feedback";
import { useBenchmarks } from "./use-benchmarks";
import { useCorporateBenchmarks } from "./use-corporate-benchmarks";
import { CorpChartKeyBar } from "./corp-chart-key-bar";
import {
  ResultsSkillSidebar,
  type SkillScore,
} from "./results-skill-sidebar";

interface CorpResultsPageProps {
  hasResults: boolean;
  templateId: string;
  corporationId: string;
  cohortId: string;
  skillGroupResults: SkillGroupResult[];
  skillScores: SkillScore[];
  feedbackText: string;
  emptyResultsMessage?: string;
  emptyFeedbackMessage?: string;
}

const GROUP_DEMOGRAPHIC = [
  { key: "cohortGroup", label: "Group", icon: Users },
];

export function CorpResultsPage({
  hasResults,
  templateId,
  corporationId,
  cohortId,
  skillGroupResults,
  skillScores,
  feedbackText,
  emptyResultsMessage,
  emptyFeedbackMessage,
}: CorpResultsPageProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [benchmarkType, setBenchmarkType] = useState<"global" | "corporate">(
    "global"
  );
  const [showReviewerScores, setShowReviewerScores] = useState(false);

  const { data: globalBenchmarks, isLoading: globalLoading } = useBenchmarks({
    skillGroups: skillGroupResults,
    templateId,
    filters,
    enabled: hasResults && benchmarkType === "global",
  });

  const { data: corpBenchmarks, isLoading: corpLoading } = useCorporateBenchmarks({
    skillGroups: skillGroupResults,
    corporationId,
    cohortId,
    templateId,
    filters,
    enabled: hasResults && benchmarkType === "corporate",
  });

  const benchmarks =
    benchmarkType === "corporate" ? corpBenchmarks : globalBenchmarks;
  const benchmarksLoading =
    benchmarkType === "corporate" ? corpLoading : globalLoading;

  // TODO: wire up reviewer scores from API when available
  const reviewerScores: Record<string, number> = {};

  const selectedGroup = skillGroupResults.find(
    (group) => group.id === selectedGroupId
  );
  const selectedSkills = skillScores.filter(
    (skill) => skill.groupId === selectedGroupId
  );
  const selectedBenchmark = selectedGroupId
    ? benchmarks[selectedGroupId]
    : undefined;

  return (
    <div className="space-y-6">
      <AssessmentResultsChart
        skillGroups={skillGroupResults}
        templateId={templateId}
        hasResults={hasResults}
        filters={filters}
        onSelectGroup={(groupId) => setSelectedGroupId(groupId)}
        benchmarks={benchmarks}
        reviewerScores={reviewerScores}
        showReviewerScores={showReviewerScores}
        emptyStateMessage={emptyResultsMessage}
        keyBarSlot={
          <CorpChartKeyBar
            benchmarkType={benchmarkType}
            onBenchmarkTypeChange={setBenchmarkType}
            showReviewerScores={showReviewerScores}
            onToggleReviewerScores={setShowReviewerScores}
          />
        }
      />

      <BenchmarkOptions
        onApply={setFilters}
        extraDemographics={GROUP_DEMOGRAPHIC}
        showDateRange
      />

      <AssessmentFeedback
        hasResults={hasResults}
        skillGroups={skillGroupResults}
        templateId={templateId}
        filters={filters}
        feedbackText={feedbackText}
        benchmarks={benchmarks}
        benchmarksLoading={benchmarksLoading}
        emptyStateMessage={emptyFeedbackMessage}
      />

      <ResultsSkillSidebar
        open={selectedGroupId != null}
        onOpenChange={(open) =>
          setSelectedGroupId(open ? selectedGroupId : null)
        }
        skillGroup={selectedGroup ?? null}
        benchmark={selectedBenchmark}
        skills={selectedSkills}
        templateId={templateId}
        filters={filters}
      />
    </div>
  );
}
