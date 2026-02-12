"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface BenchmarkOptionsProps {
  onApply: (filters: Record<string, string>) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterOptions = Record<string, any[]>;

const DEMOGRAPHICS = [
  { key: "role", label: "Role" },
  { key: "functionalArea", label: "Function" },
  { key: "industry", label: "Industry" },
  { key: "educationLevel", label: "Education" },
  { key: "yearsExperience", label: "Experience" },
  { key: "jobLevel", label: "Seniority" },
  // { key: "subRegion", label: "Department" },
];

const GEOGRAPHY = [
  { key: "country", label: "Country" },
  { key: "region", label: "Region" },
  { key: "subRegion", label: "Sub Region" },
];

export function BenchmarkOptions({ onApply }: BenchmarkOptionsProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<FilterOptions>({});

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

  const handleReset = () => {
    setFilters({});
    onApply({});
  };

  return (
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {DEMOGRAPHICS.map((d) => (
              <div key={d.key}>
                <label className="mb-1 block text-[10px] font-medium text-[#004070]">
                  {d.label}
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
                <label className="mb-1 block text-[10px] font-medium text-[#004070]">
                  {g.label}
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
            onClick={() => onApply(filters)}
            className="rounded-full bg-[#004070] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003060]"
          >
            View
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
