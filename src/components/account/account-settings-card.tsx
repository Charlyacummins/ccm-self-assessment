"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type AccountSettingsData = {
  summaryReportMode: "summary_reports" | "assessment_completion";
  dashboardOption: "insights" | "assessments";
  percentageBasedScoring: boolean;
  benchmarkDefault: "global" | "country";
};

export function AccountSettingsCard({
  initialData,
}: {
  initialData: AccountSettingsData;
}) {
  const [savedForm, setSavedForm] = useState<AccountSettingsData>(initialData);
  const [form, setForm] = useState<AccountSettingsData>(initialData);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(
    () =>
      form.summaryReportMode !== savedForm.summaryReportMode ||
      form.dashboardOption !== savedForm.dashboardOption ||
      form.percentageBasedScoring !== savedForm.percentageBasedScoring ||
      form.benchmarkDefault !== savedForm.benchmarkDefault,
    [form, savedForm]
  );

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save settings.");
      }
      setSavedForm(form);
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(savedForm);
    setStatus(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#004070]">Account Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h4 className="text-sm font-semibold text-[#004070]">Settings</h4>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-sm text-[#004070]">
                <input
                  type="radio"
                  name="summary_reports"
                  checked={form.summaryReportMode === "summary_reports"}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      summaryReportMode: "summary_reports",
                    }))
                  }
                  className="mt-0.5"
                />
                <span>
                  Send me summary reports
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Periodic reporting when there is an active assessment
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-[#004070]">
                <input
                  type="radio"
                  name="summary_reports"
                  checked={form.summaryReportMode === "assessment_completion"}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      summaryReportMode: "assessment_completion",
                    }))
                  }
                  className="mt-0.5"
                />
                <span>
                  Assessment completion
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Get notified when a new assessment is completed
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[#004070]">Preferences</h4>
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-sm text-[#004070]">Dashboard Options</p>
                <div className="mt-2 flex items-center gap-4 text-sm text-[#004070]">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="dashboard_option"
                      checked={form.dashboardOption === "insights"}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          dashboardOption: "insights",
                        }))
                      }
                    />
                    Insights
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="dashboard_option"
                      checked={form.dashboardOption === "assessments"}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          dashboardOption: "assessments",
                        }))
                      }
                    />
                    Assessments
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[#004070]">
              Results &amp; Benchmarking
            </h4>
            <div className="mt-3 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm text-[#004070]">
                  <input
                    type="checkbox"
                    checked={form.percentageBasedScoring}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        percentageBasedScoring: e.target.checked,
                      }))
                    }
                  />
                  Percentage based scoring
                </label>
                <p className="text-xs text-muted-foreground">
                  Present scores as a percentage
                </p>
              </div>
              <div>
                <p className="text-sm text-[#004070]">Benchmark Default</p>
                <div className="mt-2 flex items-center gap-4 text-sm text-[#004070]">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="benchmark_default"
                      checked={form.benchmarkDefault === "global"}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          benchmarkDefault: "global",
                        }))
                      }
                    />
                    Global
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="benchmark_default"
                      checked={form.benchmarkDefault === "country"}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          benchmarkDefault: "country",
                        }))
                      }
                    />
                    Country
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {status ? (
            <span className="text-sm text-muted-foreground">{status}</span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={!hasChanges || saving}
              className="h-11 rounded-lg border-[#00ABEB] px-8 text-[#00ABEB] hover:bg-[#00ABEB]/5 hover:text-[#00ABEB]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="h-11 rounded-lg bg-[#003B64] px-8 text-white hover:bg-[#002f50]"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
