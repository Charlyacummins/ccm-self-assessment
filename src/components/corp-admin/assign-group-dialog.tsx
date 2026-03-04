"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Users } from "lucide-react";

type GroupOption = {
  id: string;
  name: string;
};

export function AssignGroupDialog({
  cohortId,
  selectedUserIds,
  role,
  onAssigned,
  className,
}: {
  cohortId: string;
  selectedUserIds: string[];
  role: "user" | "reviewer";
  onAssigned: () => Promise<void> | void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const selectedCount = selectedUserIds.length;
  const disabled = !cohortId || selectedCount === 0;

  useEffect(() => {
    if (!open || !cohortId) return;
    setLoadingGroups(true);
    setMessage(null);
    fetch(`/api/corp-admin/cohort-groups?cohortId=${cohortId}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "Failed to load groups"
          );
        }
        const options = Array.isArray(data)
          ? data
              .map((row) => ({
                id: typeof row?.id === "string" ? row.id : "",
                name: typeof row?.name === "string" ? row.name : "",
              }))
              .filter((row) => row.id && row.name)
          : [];
        setGroups(options);
      })
      .catch((error) => {
        setGroups([]);
        setMessage(error instanceof Error ? error.message : "Failed to load groups.");
      })
      .finally(() => setLoadingGroups(false));
  }, [open, cohortId]);

  const hasGroups = groups.length > 0;
  const canSave = !saving && !!selectedGroupId && selectedCount > 0;
  const selectedGroupLabel = useMemo(
    () => groups.find((group) => group.id === selectedGroupId)?.name ?? "",
    [groups, selectedGroupId]
  );

  const handleAssign = async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/corp-admin/cohort-groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          groupId: selectedGroupId,
          memberUserIds: selectedUserIds,
          role,
        }),
      });
      const payload = (await res.json()) as { error?: string; assignedCount?: number };
      if (!res.ok) throw new Error(payload.error ?? "Failed to assign group");

      await onAssigned();
      setMessage(`Assigned ${payload.assignedCount ?? selectedCount} to ${selectedGroupLabel}.`);
      setOpen(false);
      setSelectedGroupId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to assign group.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={className ?? "gap-1.5 border-gray-200 text-xs text-[#004070]"}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Users className="h-3.5 w-3.5" /> Group
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">Assign To Group</DialogTitle>
          <div className="space-y-3">
            <p className="text-sm text-[#534F4F]">
              {selectedCount} selected {selectedCount === 1 ? "member" : "members"}.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={loadingGroups || !hasGroups}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
              >
                <option value="">
                  {loadingGroups ? "Loading groups..." : hasGroups ? "Select a group" : "No groups available"}
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            {message ? <p className="text-xs text-[#004070]">{message}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleAssign()}
                disabled={!canSave}
                className="bg-[#004070] text-white hover:bg-[#003560]"
              >
                {saving ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
