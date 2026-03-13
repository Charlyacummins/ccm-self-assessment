"use client";

import { useState } from "react";
import {
  AssessmentResultsChart,
  type SkillGroupResult,
} from "./assessment-results-chart";
import { BenchmarkOptions } from "./benchmark-options";
import { AssessmentFeedback } from "./assessment-feedback";
import { useCorporateBenchmarks } from "./use-corporate-benchmarks";
import { CorpChartKeyBar } from "./corp-chart-key-bar";
import {
  ResultsSkillSidebar,
  type SkillScore,
} from "./results-skill-sidebar";
import { CohortFilterPanel } from "./cohort-filter-panel";

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
  onCohortFiltersChange?: (filters: Record<string, string>) => void;
  percentageBasedScoring?: boolean;
  initialFilters?: Record<string, string>;
}

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
  onCohortFiltersChange,
  percentageBasedScoring = true,
  initialFilters,
}: CorpResultsPageProps) {
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters ?? {});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: benchmarks, isLoading: benchmarksLoading } = useCorporateBenchmarks({
    skillGroups: skillGroupResults,
    corporationId,
    cohortId,
    templateId,
    filters,
    type: "global",
    enabled: hasResults,
  });

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
        emptyStateMessage={emptyResultsMessage}
        subjectLabel="Cohort"
        keyBarSlot={<CorpChartKeyBar subjectLabel="Cohort" />}
        filterSlot={
          <CohortFilterPanel
            cohortId={cohortId}
            onApply={(f) => { setFilters(f); onCohortFiltersChange?.(f); }}
            embedded
          />
        }
        percentageBasedScoring={percentageBasedScoring}
      />

      <BenchmarkOptions onApply={setFilters} showDateRange initialValues={initialFilters} />

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
        skillBenchmarkEndpoint="/api/corp-admin/skill-benchmark"
        skillScoreLabel="Cohort Avg"
      />
    </div>
  );
}
