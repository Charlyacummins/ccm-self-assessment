"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type AccountManagementData = {
  fullName: string;
  country: string;
  subRegion: string;
  jobRole: string;
  industry: string;
  yearsExperience: string;
  educationLevel: string;
  functionalArea: string;
  seniorityLevel: string;
};

type FilterOptions = Record<string, string[]>;

export function AccountManagementForm({
  initialData,
}: {
  initialData: AccountManagementData;
}) {
  const [form, setForm] = useState<AccountManagementData>(initialData);
  const [options, setOptions] = useState<FilterOptions>({});
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/assessment/filter-options")
      .then((res) => res.json())
      .then((data) => setOptions(data))
      .catch(() => {});
  }, []);

  const updateField = (key: keyof AccountManagementData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    const { subRegion: _ignoredSubRegion, ...payload } = form;

    try {
      const res = await fetch("/api/account/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save account details.");
      }
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#004070]">Account Management</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Full Name
              </label>
              <Input
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Job Role
              </label>
              <select
                value={form.jobRole}
                onChange={(e) => updateField("jobRole", e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
              >
                <option value="">Select</option>
                {(options.role ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Industry
              </label>
              <select
                value={form.industry}
                onChange={(e) => updateField("industry", e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
              >
                <option value="">Select</option>
                {(options.industry ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Functional Area
              </label>
              <select
                value={form.functionalArea}
                onChange={(e) => updateField("functionalArea", e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
              >
                <option value="">Select</option>
                {(options.functionalArea ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Seniority Level
              </label>
              <select
                value={form.seniorityLevel}
                onChange={(e) => updateField("seniorityLevel", e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
              >
                <option value="">Select</option>
                {(options.jobLevel ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Years of Experience
              </label>
              <select
                value={form.yearsExperience}
                onChange={(e) => updateField("yearsExperience", e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
              >
                <option value="">Select</option>
                {(options.yearsExperience ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Education Level
              </label>
              <select
                value={form.educationLevel}
                onChange={(e) => updateField("educationLevel", e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
              >
                <option value="">Select</option>
                {(options.educationLevel ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">
                Country
              </label>
              <select
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-[#004070]"
              >
                <option value="">Select</option>
                {(options.country ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {status ? (
              <span className="text-sm text-muted-foreground">{status}</span>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={saving}
              className="h-11 rounded-lg bg-[#004070] px-8 text-white hover:bg-[#003060]"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
