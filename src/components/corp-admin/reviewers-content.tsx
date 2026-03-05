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
import {
  Download,
  Search,
  ArrowUpDown,
  Pencil,
  SlidersHorizontal,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import type { TemplateOption } from "./manage-assessments-content";
import type { CohortMemberRow } from "@/app/api/corp-admin/cohort-members/route";
import { downloadCsv, sanitizeCsvFilename, toCsv } from "@/lib/csv";

type MemberStatusFilter = "all" | "Invited" | "Accepted" | "Active" | "Completed";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

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

export function ReviewersContent({ templateOptions }: { templateOptions: TemplateOption[] }) {
  const [cohortId, setCohortId] = useState(templateOptions[0]?.value ?? "");
  const [reviewers, setReviewers] = useState<CohortMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [rosterUsers, setRosterUsers] = useState<CohortMemberRow[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [tableMessage, setTableMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editReviewerId, setEditReviewerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editReviewerUserIds, setEditReviewerUserIds] = useState<string[]>([]);
  const [editRosterSearch, setEditRosterSearch] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Invite form state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteGroup, setInviteGroup] = useState("");
  const [inviteReviewing, setInviteReviewing] = useState("");

  const selectedOption = templateOptions.find((option) => option.value === cohortId);
  const corporationId = selectedOption?.corporationId ?? "";

  const loadReviewers = async () => {
    if (!cohortId) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const [reviewerRes, usersRes] = await Promise.all([
        fetch(`/api/corp-admin/cohort-members?cohortId=${cohortId}&role=reviewer`),
        fetch(`/api/corp-admin/cohort-members?cohortId=${cohortId}&role=user`),
      ]);
      const [reviewerData, usersData] = await Promise.all([reviewerRes.json(), usersRes.json()]);
      setReviewers(Array.isArray(reviewerData) ? reviewerData : []);
      setRosterUsers(Array.isArray(usersData) ? usersData : []);
    } catch {
      setReviewers([]);
      setRosterUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviewers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId]);

  const submitInvite = async (resend: boolean) => {
    const res = await fetch("/api/corp-admin/cohort-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cohortId,
        corporationId,
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: "reviewer",
        resend,
      }),
    });

    const payload = (await res.json()) as {
      error?: string;
      status?: "invited" | "resent" | "already_invited" | "already_member" | "added_member";
      canResend?: boolean;
    };

    if (!res.ok) {
      throw new Error(payload.error ?? "Failed to invite reviewer");
    }

    return payload;
  };

  const handleInvite = async () => {
    if (!cohortId || !corporationId) {
      setInviteMessage("Please select a valid cohort.");
      return;
    }
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteMessage("Name and email are required.");
      return;
    }

    setInviteSaving(true);
    setInviteMessage(null);
    try {
      const result = await submitInvite(false);

      if (result.status === "already_invited" && result.canResend) {
        setResendModalOpen(true);
        return;
      }

      if (result.status === "invited") {
        setInviteMessage("Invitation sent.");
      } else if (result.status === "resent") {
        setInviteMessage("Invitation resent.");
      } else if (result.status === "added_member") {
        setInviteMessage("Existing reviewer added to cohort.");
      } else if (result.status === "already_member") {
        setInviteMessage("This reviewer is already in the cohort.");
      } else if (result.status === "already_invited") {
        setInviteMessage("This reviewer is already invited.");
      }

      setInviteName("");
      setInviteEmail("");
      setInviteDept("");
      setInviteGroup("");
      setInviteReviewing("");
      await loadReviewers();
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : "Failed to invite reviewer.");
    } finally {
      setInviteSaving(false);
    }
  };

  const handleResendInvite = async () => {
    setInviteSaving(true);
    setInviteMessage(null);
    try {
      const result = await submitInvite(true);
      if (result.status === "resent") {
        setInviteMessage("Invitation resent.");
      } else {
        setInviteMessage("Invitation sent.");
      }
      setResendModalOpen(false);
      await loadReviewers();
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : "Failed to resend invitation.");
    } finally {
      setInviteSaving(false);
    }
  };

  const allSelected = reviewers.length > 0 && reviewers.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(reviewers.map((r) => r.id)));
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const filtered = reviewers.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.assessmentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const hasActiveFilters = statusFilter !== "all";

  const assignedUserIdsByReviewer = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rosterUser of rosterUsers) {
      if (!rosterUser.reviewerId) continue;
      const current = map.get(rosterUser.reviewerId) ?? [];
      current.push(rosterUser.id);
      map.set(rosterUser.reviewerId, current);
    }
    return map;
  }, [rosterUsers]);

  const assignedCountByReviewer = useMemo(() => {
    const map = new Map<string, number>();
    for (const [reviewerId, userIds] of assignedUserIdsByReviewer.entries()) {
      map.set(reviewerId, userIds.length);
    }
    return map;
  }, [assignedUserIdsByReviewer]);

  const handleExport = () => {
    const rows: Array<Array<string>> = [
      ["Name", "Email", "Assessment Status", "Assigned Invitees"],
      ...filtered.map((reviewer) => [
        reviewer.name,
        reviewer.email,
        reviewer.assessmentStatus,
        String(assignedCountByReviewer.get(reviewer.id) ?? 0),
      ]),
    ];
    const filename = `reviewers-roster-${sanitizeCsvFilename(
      templateOptions.find((option) => option.value === cohortId)?.label ?? cohortId ?? "cohort"
    )}.csv`;
    downloadCsv(filename, toCsv(rows));
  };

  const openEditModal = (reviewer: CohortMemberRow) => {
    setEditReviewerId(reviewer.id);
    setEditName(reviewer.name === "—" ? "" : reviewer.name);
    setEditEmail(reviewer.email === "—" ? "" : reviewer.email);
    setEditReviewerUserIds(assignedUserIdsByReviewer.get(reviewer.id) ?? []);
    setEditRosterSearch("");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!cohortId || !editReviewerId) return;
    setEditSaving(true);
    setTableMessage(null);
    try {
      const res = await fetch("/api/corp-admin/cohort-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          userId: editReviewerId,
          role: "reviewer",
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          reviewerUserIds: editReviewerUserIds,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to update reviewer");
      setEditOpen(false);
      setTableMessage("Reviewer updated.");
      await loadReviewers();
    } catch (error) {
      setTableMessage(error instanceof Error ? error.message : "Failed to update reviewer.");
    } finally {
      setEditSaving(false);
    }
  };

  const filteredRosterUsers = rosterUsers.filter((user) => {
    const query = editRosterSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const toggleRosterUser = (userId: string) => {
    setEditReviewerUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">Edit Reviewer</DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Email</label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">
                Assigned Invitees ({editReviewerUserIds.length})
              </label>
              <Input
                placeholder="Search invitees"
                value={editRosterSearch}
                onChange={(e) => setEditRosterSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="max-h-44 overflow-y-auto rounded-md border border-input p-2">
                {filteredRosterUsers.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    No invitees found.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredRosterUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                      >
                        <span className="truncate pr-3 text-xs text-[#004070]">
                          {user.name} <span className="text-muted-foreground">({user.email})</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={editReviewerUserIds.includes(user.id)}
                          onChange={() => toggleRosterUser(user.id)}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-[#004070]"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={editSaving || !editReviewerId}
                className="bg-[#004070] text-white hover:bg-[#003560]"
              >
                {editSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={resendModalOpen} onOpenChange={setResendModalOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">
            Reviewer Already Invited
          </DialogTitle>
          <p className="text-sm text-[#534F4F]">
            This reviewer has already been invited. Would you like to resend the invitation?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResendModalOpen(false)}
              disabled={inviteSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleResendInvite}
              disabled={inviteSaving}
              className="bg-[#004070] text-white hover:bg-[#003560]"
            >
              Resend
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">Filter Reviewers</DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Assessment Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target.value as MemberStatusFilter) ?? "all")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
              >
                <option value="all">All</option>
                <option value="Invited">Invited</option>
                <option value="Accepted">Accepted</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="bg-[#004070] text-white hover:bg-[#003560]"
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cohort selector */}
      <CohortSelector options={templateOptions} value={cohortId} onChange={setCohortId} />

      {/* Reviewers table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-base text-[#004070]">Reviewers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterOpen(true)}
              className={`rounded-md border p-2 hover:bg-gray-50 ${
                hasActiveFilters ? "border-[#004070] text-[#004070]" : "text-muted-foreground"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="gap-1.5 border-gray-200 text-xs text-[#004070]"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 pl-8 text-xs"
              />
            </div>
          </div>
          {tableMessage ? <p className="text-xs text-[#004070]">{tableMessage}</p> : null}
          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {cohortId ? "No reviewers found in this cohort." : "Select a cohort to view reviewers."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 px-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#004070]"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">
                    <span className="flex items-center gap-1">Reviewer <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">
                    <span className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">Status</TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">Assigned Invitees</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reviewer) => (
                  <TableRow key={reviewer.id} className={selected.has(reviewer.id) ? "bg-[#00ABEB]/10" : ""}>
                    <TableCell className="px-2">
                      <input
                        type="checkbox"
                        checked={selected.has(reviewer.id)}
                        onChange={() => toggleRow(reviewer.id)}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#004070]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-[#004070]">
                          {initials(reviewer.name)}
                        </span>
                        <span className="text-xs text-[#004070]">{reviewer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[#004070]">{reviewer.email}</TableCell>
                    <TableCell className="text-xs font-semibold text-[#004070]">
                      {reviewer.assessmentStatus}
                    </TableCell>
                    <TableCell className="text-xs text-[#004070]">
                      {assignedCountByReviewer.get(reviewer.id) ?? 0}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openEditModal(reviewer)}
                        className="flex items-center gap-1 text-xs text-[#004070] hover:text-[#00ABEB]"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite reviewer form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-base text-[#004070]">Invite Reviewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#004070]">Name</label>
              <Input
                placeholder="Full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#004070]">Email</label>
              <Input
                placeholder="example@acme.com"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#004070]">Department <span className="text-muted-foreground">(Optional)</span></label>
              <div className="relative">
                <select
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
                >
                  <option value="">Select</option>
                </select>
                <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#004070]">Group <span className="text-muted-foreground">(Optional)</span></label>
              <div className="relative">
                <select
                  value={inviteGroup}
                  onChange={(e) => setInviteGroup(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
                >
                  <option value="">Select</option>
                </select>
                <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#004070]">Reviewing</label>
              <div className="relative">
                <select
                  value={inviteReviewing}
                  onChange={(e) => setInviteReviewing(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
                >
                  <option value="">Select</option>
                </select>
                <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={inviteSaving || !cohortId || !corporationId}
              onClick={handleInvite}
              className="bg-[#004070] px-8 text-white hover:bg-[#003560]"
            >
              Invite
            </Button>
          </div>
          {inviteMessage ? (
            <p className="text-xs text-[#004070]">{inviteMessage}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
