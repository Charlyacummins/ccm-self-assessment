"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  UserCog,
  Settings,
  Building2,
  GraduationCap,
  BriefcaseBusiness,
  Users,
  Flag,
  MapPin,
  Map,
  CalendarDays,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface DemographicDef {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface BenchmarkOptionsProps {
  onApply: (filters: Record<string, string>) => void;
  extraDemographics?: DemographicDef[];
  showDateRange?: boolean;
  onDateRangeChange?: (start: string, end: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterOptions = Record<string, any[]>;
type YearsExperienceOption = { key: string; label: string };

const DEMOGRAPHICS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "role", label: "Role", icon: UserCog },
  { key: "functionalArea", label: "Function", icon: Settings },
  { key: "industry", label: "Industry", icon: Building2 },
  { key: "educationLevel", label: "Education", icon: GraduationCap },
  { key: "yearsExperience", label: "Experience", icon: BriefcaseBusiness },
  { key: "jobLevel", label: "Seniority", icon: Users },
  // { key: "subRegion", label: "Department" },
];

const GEOGRAPHY: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "country", label: "Country", icon: Flag },
  { key: "region", label: "Region", icon: MapPin },
  { key: "subRegion", label: "Sub Region", icon: Map },
];

const FILTER_LABELS: Record<string, string> = {
  role: "Role",
  functionalArea: "Function",
  industry: "Industry",
  educationLevel: "Education",
  yearsExperience: "Experience",
  jobLevel: "Seniority",
  country: "Country",
  region: "Region",
  subRegion: "Sub Region",
  submittedYear: "Year",
};

export function BenchmarkOptions({
  onApply,
  extraDemographics,
  showDateRange,
  onDateRangeChange,
}: BenchmarkOptionsProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<FilterOptions>({});
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    fetch("/api/assessment/filter-options")
      .then((res) => res.json())
      .then((data) => setOptions(data))
      .catch(() => {});
  }, []);

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value || value === "All") {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleDateChange = (start: string, end: string) => {
    setDateStart(start);
    setDateEnd(end);
    onDateRangeChange?.(start, end);
  };

  const getSubmittedYearFilter = () => {
    const startYear = dateStart ? dateStart.split("-")[0] : null;
    const endYear = dateEnd ? dateEnd.split("-")[0] : null;

    if (startYear && endYear && startYear !== endYear) return null;

    const year = endYear || startYear;
    if (!year) return null;
    return /^\d{4}$/.test(year) ? year : null;
  };

  const handleApply = () => {
    const next = { ...filters };
    const submittedYear = getSubmittedYearFilter();
    if (submittedYear) {
      next.submittedYear = submittedYear;
    } else {
      delete next.submittedYear;
    }
    setAppliedFilters(Object.keys(next).length > 0 ? next : null);
    onApply(next);
  };

  const handleReset = () => {
    setFilters({});
    setDateStart("");
    setDateEnd("");
    setAppliedFilters(null);
    onDateRangeChange?.("", "");
    onApply({});
  };

  const yearsExperienceOptions = (options.yearsExperience ?? []) as
    | YearsExperienceOption[]
    | string[];

  return (
  <div className="space-y-3">
    <Card>
      <CardContent className="py-8">
        <h2 className="mb-6 text-center text-lg font-semibold text-[#004070]">
          Benchmark Options
        </h2>

        {/* Demographics */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-[#004070]">
            Demographics
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {DEMOGRAPHICS.map((d) => (
              <div key={d.key} className="w-[calc(20%-0.6rem)]">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#004070]">
                  {d.label}
                  <d.icon className="h-4 w-4" strokeWidth={2.5} />
                </label>
                <select
                  value={filters[d.key] ?? ""}
                  onChange={(e) => updateFilter(d.key, e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
                >
                  <option value="">All</option>
                  {d.key === "yearsExperience"
                    ? yearsExperienceOptions.map((opt) =>
                        typeof opt === "string" ? (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ) : (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        )
                      )
                    : (options[d.key] ?? []).map((opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                </select>
              </div>
            ))}
            {extraDemographics?.map((d) => (
              <div key={d.key} className="w-[calc(20%-0.6rem)]">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#004070]">
                  {d.label}
                  <d.icon className="h-4 w-4" strokeWidth={2.5} />
                </label>
                <select
                  value={filters[d.key] ?? ""}
                  onChange={(e) => updateFilter(d.key, e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
                >
                  <option value="">All</option>
                  {(options[d.key] ?? []).map((opt: string) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {showDateRange && (
              <div className="w-[calc(20%-0.6rem)]">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#004070]">
                  Date Range
                  <CalendarDays className="h-4 w-4" strokeWidth={2.5} />
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => handleDateChange(e.target.value, dateEnd)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => handleDateChange(dateStart, e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Geography */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-[#004070]">
            Geography
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {GEOGRAPHY.map((g) => (
              <div key={g.key}>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#004070]">
                  {g.label}
                  <g.icon className="h-4 w-4" strokeWidth={2.5} />
                </label>
                <select
                  value={filters[g.key] ?? ""}
                  onChange={(e) => updateFilter(g.key, e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
                >
                  <option value="">All</option>
                  {(options[g.key] ?? []).map((opt: string) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleReset}
            className="rounded-full border border-[#00ABEB] px-6 py-2 text-sm font-medium text-[#00ABEB] transition-colors hover:bg-[#00ABEB]/5"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="rounded-full bg-[#004070] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003060]"
          >
            View
          </button>
        </div>
      </CardContent>
    </Card>

    {appliedFilters && Object.keys(appliedFilters).length > 0 && (
      <div className="rounded-lg border border-[#00ABEB]/30 bg-[#00ABEB]/5 px-4 py-3 text-sm text-[#004070]">
        <span className="font-medium">Showing benchmark results for users with: </span>
        {Object.entries(appliedFilters)
          .map(([key, value]) => `${FILTER_LABELS[key] ?? key}: ${value}`)
          .join(" · ")}
      </div>
    )}
  </div>
  );
}
