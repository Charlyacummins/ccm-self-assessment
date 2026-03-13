"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CorpResultsPage } from "@/components/results/corp-results-page";
import type { TemplateOption } from "./manage-assessments-content";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";
import type { SkillGroupResult } from "@/components/results/assessment-results-chart";
import type { SkillScore } from "@/components/results/results-skill-sidebar";

type CohortResultsPayload = {
  hasResults: boolean;
  templateId: string;
  corporationId: string;
  cohortId: string;
  individualResultVisibility: boolean;
  skillGroupResults: SkillGroupResult[];
  skillScores: SkillScore[];
  feedbackText: string;
};

function CohortSelector({
  options,
  value,
  onChange,
}: {
  options: TemplateOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-80">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-full border border-gray-200 bg-gray-50 px-4 py-2 pr-8 text-sm font-medium text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
      >
        {options.length === 0 ? (
          <option value="">No cohorts available</option>
        ) : (
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#004070]" />
    </div>
  );
}

export function AdminResultsContent({
  templateOptions,
  initialSelectedCohortId,
  percentageBasedScoring = true,
  initialBenchmarkFilters,
}: {
  templateOptions: TemplateOption[];
  initialSelectedCohortId?: string | null;
  percentageBasedScoring?: boolean;
  initialBenchmarkFilters?: Record<string, string>;
}) {
  const initialCohortId =
    initialSelectedCohortId &&
    templateOptions.some((option) => option.value === initialSelectedCohortId)
      ? initialSelectedCohortId
      : (templateOptions[0]?.value ?? "");

  const [cohortId, setCohortId] = useState(initialCohortId);
  const [cohortFilters, setCohortFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CohortResultsPayload | null>(null);

  useEffect(() => {
    if (!cohortId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ cohortId, ...cohortFilters });
    fetch(`/api/corp-admin/cohort-results?${params}`)
      .then(async (res) => {
        const payload = (await res.json()) as CohortResultsPayload & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Failed to load results");
        setData(payload);
      })
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Failed to load results");
      })
      .finally(() => setLoading(false));
  }, [cohortId, cohortFilters]);

  const handleCohortChange = (nextCohortId: string) => {
    setCohortId(nextCohortId);
    if (!nextCohortId) {
      document.cookie = `${CORP_ADMIN_SELECTED_COHORT_COOKIE}=; path=/; max-age=0; samesite=lax`;
      return;
    }
    document.cookie = `${CORP_ADMIN_SELECTED_COHORT_COOKIE}=${encodeURIComponent(nextCohortId)}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="space-y-6">
      <CohortSelector options={templateOptions} value={cohortId} onChange={handleCohortChange} />

      {loading && !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-muted-foreground">
          Loading results...
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-red-600">
          {error}
        </div>
      ) : !data ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-muted-foreground">
          Select a cohort to view results.
        </div>
      ) : (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 rounded-lg bg-white/60" />
          )}
          <CorpResultsPage
            hasResults={data.hasResults}
            templateId={data.templateId}
            corporationId={data.corporationId}
            cohortId={data.cohortId}
            skillGroupResults={data.skillGroupResults}
            skillScores={data.skillScores}
            feedbackText={data.feedbackText}
            emptyResultsMessage="Once users in your cohort have completed assessments, results will show here."
            emptyFeedbackMessage="Once users in your cohort have completed assessments, results will show here."
            onCohortFiltersChange={setCohortFilters}
            percentageBasedScoring={percentageBasedScoring}
            initialFilters={initialBenchmarkFilters}
          />
        </div>
      )}
    </div>
  );
}
