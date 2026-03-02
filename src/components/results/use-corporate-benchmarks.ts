"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillGroupResult } from "./assessment-results-chart";
import type { BenchmarkData } from "./use-benchmarks";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const memoryCache = new Map<
  string,
  { ts: number; data: BenchmarkData | null }
>();

function stableFilterKey(filters?: Record<string, string> | null) {
  const safeFilters = filters ?? {};
  const keys = Object.keys(safeFilters).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}=${safeFilters[k]}`).join("&");
}

function getCacheKey(
  corporationId: string,
  cohortId: string,
  templateId: string,
  skillGroupId: string,
  filterKey: string
) {
  return `corp-benchmarks:${corporationId}:${cohortId}:${templateId}:${skillGroupId}:${filterKey}`;
}

function readCache(key: string) {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && now - mem.ts < TWELVE_HOURS_MS) return mem.data;

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      ts: number;
      data: BenchmarkData | null;
    };
    if (now - parsed.ts > TWELVE_HOURS_MS) return null;
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: BenchmarkData | null) {
  const payload = { ts: Date.now(), data };
  memoryCache.set(key, payload);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function useCorporateBenchmarks({
  skillGroups,
  corporationId,
  cohortId,
  templateId,
  filters,
  enabled,
}: {
  skillGroups: SkillGroupResult[];
  corporationId: string;
  cohortId: string;
  templateId: string;
  filters: Record<string, string>;
  enabled: boolean;
}) {
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkData>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(enabled);

  const fetchBenchmarks = useCallback(async () => {
    const filterKey = stableFilterKey(filters);
    const results: Record<string, BenchmarkData> = {};
    const toFetch: SkillGroupResult[] = [];

    for (const sg of skillGroups) {
      const key = getCacheKey(corporationId, cohortId, templateId, sg.id, filterKey);
      const cached = readCache(key);
      if (cached) {
        results[sg.id] = cached;
      } else {
        toFetch.push(sg);
      }
    }

    if (toFetch.length === 0) {
      setBenchmarks(results);
      return;
    }

    await Promise.all(
      toFetch.map(async (sg) => {
        const params = new URLSearchParams({
          corporationId,
          cohortId,
          templateId,
          skillGroupId: sg.id,
          ...filters,
        });
        try {
          const res = await fetch(
            `/api/assessment/corporate-benchmark?${params}`
          );
          const data = await res.json();
          const value = data && !data.error ? (data as BenchmarkData) : null;
          const key = getCacheKey(corporationId, cohortId, templateId, sg.id, filterKey);
          writeCache(key, value);
          if (value) {
            results[sg.id] = value;
          }
        } catch {
          // ignore fetch errors
        }
      })
    );

    setBenchmarks(results);
  }, [cohortId, corporationId, filters, skillGroups, templateId]);

  useEffect(() => {
    if (!enabled || skillGroups.length === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let cancelled = false;

    (async () => {
      await fetchBenchmarks();
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, skillGroups, fetchBenchmarks]);

  return { data: benchmarks, isLoading };
}
