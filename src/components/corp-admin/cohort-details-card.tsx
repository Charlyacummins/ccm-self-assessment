"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type CohortDetailsData = {
  cohortId: string;
  name: string;
  location: string;
};

export function CohortDetailsCard({ initialData }: { initialData: CohortDetailsData }) {
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/corp-admin/cohort-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: form.cohortId,
          name: form.name,
          location: form.location,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save.");
      }
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#004070]">Cohort Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">Cohort Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. ACME Corp 2026"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#004070]">Location</label>
              <Input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. New York, USA"
              />
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
