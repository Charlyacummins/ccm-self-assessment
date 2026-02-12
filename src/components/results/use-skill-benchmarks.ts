"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillScore } from "./results-skill-sidebar";

export interface SkillBenchmarkData {
  n: number | null;
  mean_score: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const memoryCache = new Map<string, { ts: number; data: SkillBenchmarkData | null }>();

function stableFilterKey(filters?: Record<string, string> | null) {
  const safeFilters = filters ?? {};
  const keys = Object.keys(safeFilters).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}=${safeFilters[k]}`).join("&");
}

function getCacheKey(
  templateId: string,
  templateSkillId: string,
  filterKey: string
) {
  return `skill-benchmarks:${templateId}:${templateSkillId}:${filterKey}`;
}

function readCache(key: string) {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && now - mem.ts < TWELVE_HOURS_MS) return mem.data;

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: SkillBenchmarkData | null };
    if (now - parsed.ts > TWELVE_HOURS_MS) return null;
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: SkillBenchmarkData | null) {
  const payload = { ts: Date.now(), data };
  memoryCache.set(key, payload);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function useSkillBenchmarks({
  skills,
  templateId,
  filters,
  enabled,
}: {
  skills: SkillScore[];
  templateId: string;
  filters: Record<string, string>;
  enabled: boolean;
}) {
  const [benchmarks, setBenchmarks] = useState<Record<string, SkillBenchmarkData>>(
    {}
  );

  const fetchBenchmarks = useCallback(async () => {
    const filterKey = stableFilterKey(filters);
    const results: Record<string, SkillBenchmarkData> = {};
    const toFetch: SkillScore[] = [];

    for (const skill of skills) {
      const key = getCacheKey(templateId, skill.templateSkillId, filterKey);
      const cached = readCache(key);
      if (cached) {
        results[skill.templateSkillId] = cached;
      } else {
        toFetch.push(skill);
      }
    }

    if (toFetch.length === 0) {
      setBenchmarks(results);
      return;
    }

    await Promise.all(
      toFetch.map(async (skill) => {
        const params = new URLSearchParams({
          templateId,
          templateSkillId: skill.templateSkillId,
          ...filters,
        });
        try {
          const res = await fetch(`/api/assessment/skill-benchmark?${params}`);
          const data = await res.json();
          const value = data && !data.error ? (data as SkillBenchmarkData) : null;
          const key = getCacheKey(templateId, skill.templateSkillId, filterKey);
          writeCache(key, value);
          if (value) {
            results[skill.templateSkillId] = value;
          }
        } catch {
          // ignore fetch errors
        }
      })
    );

    setBenchmarks(results);
  }, [filters, skills, templateId]);

  useEffect(() => {
    if (!enabled || skills.length === 0) return;
    let cancelled = false;

    (async () => {
      await fetchBenchmarks();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, skills, fetchBenchmarks]);

  return benchmarks;
}
