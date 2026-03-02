"use client";

import { useState } from "react";
import {
  AssessmentResultsChart,
  type SkillGroupResult,
} from "./assessment-results-chart";
import { BenchmarkOptions } from "./benchmark-options";
import { AssessmentFeedback } from "./assessment-feedback";
import { useBenchmarks } from "./use-benchmarks";
import {
  ResultsSkillSidebar,
  type SkillScore,
} from "./results-skill-sidebar";

interface ResultsPageProps {
  hasResults: boolean;
  templateId: string;
  skillGroupResults: SkillGroupResult[];
  skillScores: SkillScore[];
  feedbackText: string;
}

export function ResultsPage({
  hasResults,
  templateId,
  skillGroupResults,
  skillScores,
  feedbackText,
}: ResultsPageProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: benchmarks, isLoading: benchmarksLoading } = useBenchmarks({
    skillGroups: skillGroupResults,
    templateId,
    filters,
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
      />

      <BenchmarkOptions
        onApply={setFilters}
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
      />

      <ResultsSkillSidebar
        open={selectedGroupId != null}
        onOpenChange={(open) => setSelectedGroupId(open ? selectedGroupId : null)}
        skillGroup={selectedGroup ?? null}
        benchmark={selectedBenchmark}
        skills={selectedSkills}
        templateId={templateId}
        filters={filters}
      />
    </div>
  );
}
