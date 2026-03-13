"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, User } from "lucide-react";


interface FilterOptions {
  groupingEnabled: boolean;
  individualResultVisibility: boolean;
  groups: { id: string; name: string }[];
  users: { id: string; name: string }[];
}

export function CohortFilterPanel({
  cohortId,
  onApply,
  embedded = false,
}: {
  cohortId: string;
  onApply: (filters: Record<string, string>) => void;
  embedded?: boolean;
}) {
  const [options, setOptions] = useState<FilterOptions>({
    groupingEnabled: false,
    individualResultVisibility: false,
    groups: [],
    users: [],
  });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [appliedLabel, setAppliedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!cohortId) return;
    fetch(`/api/corp-admin/cohort-filter-options?cohortId=${cohortId}`)
      .then((res) => res.json())
      .then((data) => setOptions(data))
      .catch(() => {});
  }, [cohortId]);

  // Don't render if neither feature is enabled and no data yet
  if (!options.groupingEnabled && !options.individualResultVisibility) return null;

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        // group and profileId are mutually exclusive
        if (key === "groupId") delete next["profileId"];
        if (key === "profileId") delete next["groupId"];
        next[key] = value;
      }
      return next;
    });
  };

  const handleApply = () => {
    const label = buildLabel(filters);
    setAppliedLabel(label);
    onApply({ ...filters });
  };

  const handleReset = () => {
    setFilters({});
    setAppliedLabel(null);
    onApply({});
  };

  const buildLabel = (f: Record<string, string>) => {
    if (f.profileId) {
      const name = options.users.find((u) => u.id === f.profileId)?.name ?? f.profileId;
      return `User: ${name}`;
    }
    if (f.groupId) {
      const name = options.groups.find((g) => g.id === f.groupId)?.name ?? f.groupId;
      return `Group: ${name}`;
    }
    return null;
  };

  const inner = (
    <>
      <div className="flex flex-wrap items-end gap-4">
        {options.groupingEnabled && options.groups.length > 0 && (
          <div className="w-48">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#004070]">
              Group
              <Users className="h-4 w-4" strokeWidth={2.5} />
            </label>
            <select
              value={filters.groupId ?? ""}
              onChange={(e) => updateFilter("groupId", e.target.value)}
              disabled={!!filters.profileId}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070] disabled:opacity-40"
            >
              <option value="">All groups</option>
              {options.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {options.individualResultVisibility && options.users.length > 0 && (
          <div className="w-48">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#004070]">
              Individual User
              <User className="h-4 w-4" strokeWidth={2.5} />
            </label>
            <select
              value={filters.profileId ?? ""}
              onChange={(e) => updateFilter("profileId", e.target.value)}
              disabled={!!filters.groupId}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070] disabled:opacity-40"
            >
              <option value="">All users</option>
              {options.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pb-0.5">
          <button
            onClick={handleReset}
            className="rounded-full border border-[#00ABEB] px-5 py-2 text-sm font-medium text-[#00ABEB] transition-colors hover:bg-[#00ABEB]/5"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="rounded-full bg-[#004070] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003060]"
          >
            View
          </button>
        </div>
      </div>

      {appliedLabel && (
        <div className="mt-3 rounded-lg border border-[#00ABEB]/30 bg-[#00ABEB]/5 px-4 py-3 text-sm text-[#004070]">
          <span className="font-medium">Showing results for: </span>
          {appliedLabel}
        </div>
      )}
    </>
  );

  if (embedded) return inner;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-8">
          <h2 className="mb-6 text-center text-lg font-semibold text-[#004070]">
            Filter Cohort
          </h2>
          {inner}
        </CardContent>
      </Card>
    </div>
  );
}
