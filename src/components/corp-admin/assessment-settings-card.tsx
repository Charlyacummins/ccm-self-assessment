"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { CohortSettingsData } from "@/app/api/corp-admin/cohort-settings/route";

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00ABEB] ${
        checked ? "bg-[#004070]" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const DEFAULTS: CohortSettingsData = {
  individual_result_visibility: false,
  reminders_enabled: false,
  reviewers_enabled: false,
  grouping_enabled: false,
};

export function AssessmentSettingsCard({
  cohortId,
  onSaved,
}: {
  cohortId: string;
  onSaved?: (settings: CohortSettingsData) => void;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<CohortSettingsData>(DEFAULTS);
  const [reminderDays, setReminderDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!cohortId) return;
    fetch(`/api/corp-admin/cohort-settings?cohortId=${cohortId}`)
      .then((r) => r.json())
      .then((data: CohortSettingsData) => setSettings(data))
      .catch(() => setSettings(DEFAULTS));
  }, [cohortId]);

  const toggle = (key: keyof CohortSettingsData) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    if (!cohortId) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/corp-admin/cohort-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId, ...settings }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSaveStatus("Settings saved.");
      onSaved?.(settings);
      router.refresh();
    } catch {
      setSaveStatus("Could not save settings.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-base text-[#004070]">Assessment Settings</CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto space-y-5" style={{ maxHeight: "320px" }}>
        <p className="text-xs text-muted-foreground">
          Configure your assessment settings here. Any changes will only be applied to the selected
          template.
        </p>

        {/* Visibility + Groups */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#004070]">Visibility</p>
            <p className="text-xs text-muted-foreground">Admin can view individual results</p>
            <Toggle
              checked={settings.individual_result_visibility}
              onChange={() => toggle("individual_result_visibility")}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#004070]">Groups</p>
            <p className="text-xs text-muted-foreground">Buy/Sell Side Groupings</p>
            <Toggle checked={settings.grouping_enabled} onChange={() => toggle("grouping_enabled")} />
          </div>
        </div>

        {/* Reminders + Reviewer Visibility */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#004070]">Reminders</p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  className="appearance-none rounded-md border border-gray-200 bg-white px-3 py-1.5 pr-7 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#004070]" />
              </div>
              <Toggle
                checked={settings.reminders_enabled}
                onChange={() => toggle("reminders_enabled")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#004070]">Reviewers</p>
            <Toggle
              checked={settings.reviewers_enabled}
              onChange={() => toggle("reviewers_enabled")}
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !cohortId}
          className="w-full bg-[#004070] text-white hover:bg-[#003560] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        {saveStatus ? (
          <p className={`text-xs ${saveStatus === "Settings saved." ? "text-muted-foreground" : "text-red-600"}`}>
            {saveStatus}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
