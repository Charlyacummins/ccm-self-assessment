"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronsUpDown, Trash2, Pencil } from "lucide-react";
import type { TemplateOption } from "./manage-assessments-content";

type PendingInviteRow = {
  id: string;
  email: string;
  role: "user" | "reviewer";
  invited_at: string | null;
};

function CohortSelector({
  options,
  value,
  onChange,
}: {
  options: TemplateOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-64">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-full border border-gray-200 bg-gray-50 px-4 py-2 pr-8 text-sm font-medium text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
      >
        {options.length === 0 ? (
          <option value="">No cohorts available</option>
        ) : (
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#004070]" />
    </div>
  );
}

export function PendingInvitationsContent({ templateOptions }: { templateOptions: TemplateOption[] }) {
  const [cohortId, setCohortId] = useState(templateOptions[0]?.value ?? "");
  const [rows, setRows] = useState<PendingInviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editInviteId, setEditInviteId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "reviewer">("user");

  const loadRows = async () => {
    if (!cohortId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/corp-admin/cohort-invites?cohortId=${cohortId}&role=all`);
      const data = (await res.json()) as PendingInviteRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aTime = a.invited_at ? new Date(a.invited_at).getTime() : 0;
        const bTime = b.invited_at ? new Date(b.invited_at).getTime() : 0;
        return bTime - aTime;
      }),
    [rows]
  );

  const handleRevoke = async (row: PendingInviteRow) => {
    if (!cohortId) return;
    setStatusMessage(null);
    setActionId(row.id);
    try {
      const res = await fetch("/api/corp-admin/cohort-invites/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId, email: row.email }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to revoke invitation");
      setStatusMessage("Invitation revoked.");
      await loadRows();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to revoke invitation.");
    } finally {
      setActionId(null);
    }
  };

  const openEdit = (row: PendingInviteRow) => {
    setEditInviteId(row.id);
    setEditEmail(row.email);
    setEditRole(row.role);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!cohortId || !editInviteId) return;
    setStatusMessage(null);
    setActionId(editInviteId);
    try {
      const res = await fetch("/api/corp-admin/cohort-invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          inviteId: editInviteId,
          email: editEmail.trim().toLowerCase(),
          role: editRole,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to update invitation");
      setStatusMessage("Invitation updated.");
      setEditOpen(false);
      await loadRows();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to update invitation.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">Edit Invitation</DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Email</label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Role</label>
              <div className="relative">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole((e.target.value === "reviewer" ? "reviewer" : "user"))}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
                >
                  <option value="user">User</option>
                  <option value="reviewer">Reviewer</option>
                </select>
                <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={!editInviteId || actionId === editInviteId}
                className="bg-[#004070] text-white hover:bg-[#003560]"
              >
                {actionId === editInviteId ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CohortSelector options={templateOptions} value={cohortId} onChange={setCohortId} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-base text-[#004070]">Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusMessage ? <p className="text-xs text-[#004070]">{statusMessage}</p> : null}
          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading...</p>
          ) : sortedRows.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No pending invitations.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-[#004070]">Email</TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">Role</TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">Invited</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-[#004070]">{row.email}</TableCell>
                    <TableCell className="text-xs text-[#004070] capitalize">{row.role}</TableCell>
                    <TableCell className="text-xs text-[#004070]">
                      {row.invited_at ? new Date(row.invited_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row)}
                          disabled={actionId === row.id}
                          className="gap-1.5 border-gray-200 text-xs text-[#004070]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRevoke(row)}
                          disabled={actionId === row.id}
                          className="gap-1.5 border-red-300 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
