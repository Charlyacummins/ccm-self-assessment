import type { SupabaseClient } from "@supabase/supabase-js";

function parseFiniteNumber(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function resolveYearsExperienceValue(
  supabase: SupabaseClient,
  rawValue: string | null | undefined
) {
  const numeric = parseFiniteNumber(rawValue);
  if (numeric != null) return numeric;
  if (!rawValue) return null;

  const { data } = await supabase
    .from("years_experience")
    .select("key")
    .eq("label", rawValue)
    .maybeSingle();

  return parseFiniteNumber(data?.key == null ? null : String(data.key));
}

type YearsExperienceRow = {
  key: string | number | null;
  label: string | null;
  order_index: number | null;
};

function matchesYears(label: string, years: number) {
  const normalized = label.trim().toLowerCase();
  const rangeMatch = normalized.match(/(\d+)\s*[-–—to]+\s*(\d+)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return years >= min && years <= max;
  }

  const plusMatch = normalized.match(/(\d+)\s*(\+|or more|and above|and over)/);
  if (plusMatch) {
    const min = Number(plusMatch[1]);
    return years >= min;
  }

  const underMatch = normalized.match(/(less than|under|<)\s*(\d+)/);
  if (underMatch) {
    const maxExclusive = Number(underMatch[2]);
    return years < maxExclusive;
  }

  return false;
}

export async function mapYearsToExperienceRangeKey(
  supabase: SupabaseClient,
  rawYears: string | null | undefined
) {
  const years = parseFiniteNumber(rawYears);
  if (years == null) return null;

  const { data } = await supabase
    .from("years_experience")
    .select("key, label, order_index")
    .order("order_index");

  const rows = (data ?? []) as YearsExperienceRow[];
  for (const row of rows) {
    if (!row.label) continue;
    if (matchesYears(row.label, years)) {
      return parseFiniteNumber(row.key == null ? null : String(row.key));
    }
  }

  return resolveYearsExperienceValue(supabase, rawYears);
}
