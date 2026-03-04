"use client";

import { useEffect, useState } from "react";
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
  SlidersHorizontal,
  ArrowUpDown,
  Pencil,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { CohortMemberRow } from "@/app/api/corp-admin/cohort-members/route";
import { AssignGroupDialog } from "./assign-group-dialog";
import { downloadCsv, sanitizeCsvFilename, toCsv } from "@/lib/csv";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

type Tab = "users" | "reviewers";
type MemberStatusFilter = "all" | "Invited" | "Accepted" | "Active" | "Completed";
type GroupFilter = "all" | "grouped" | "ungrouped";
type GroupOption = { id: string; name: string };

export function ManageUsersTable({
  cohortId,
  settingsVersion = 0,
}: {
  cohortId: string;
  settingsVersion?: number;
}) {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<CohortMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewersEnabled, setReviewersEnabled] = useState(false);
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [seatsUsed, setSeatsUsed] = useState<number>(0);
  const [seatCount, setSeatCount] = useState<number>(0);
  const [tableMessage, setTableMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);

  const loadUsers = async () => {
    if (!cohortId) return;
    setLoading(true);
    setSelected(new Set());
    const role = tab === "reviewers" && reviewersEnabled ? "reviewer" : "user";
    try {
      const res = await fetch(`/api/corp-admin/cohort-members?cohortId=${cohortId}&role=${role}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cohortId) {
      setReviewersEnabled(false);
      setGroupingEnabled(false);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/corp-admin/cohort-settings?cohortId=${cohortId}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setReviewersEnabled(Boolean(data?.reviewers_enabled));
        setGroupingEnabled(Boolean(data?.grouping_enabled));
      })
      .catch(() => {
        setReviewersEnabled(false);
        setGroupingEnabled(false);
      });

    return () => controller.abort();
  }, [cohortId, settingsVersion]);

  useEffect(() => {
    if (!reviewersEnabled && tab === "reviewers") {
      setTab("users");
    }
  }, [reviewersEnabled, tab]);

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, tab, reviewersEnabled]);

  useEffect(() => {
    if (!cohortId || !groupingEnabled) {
      setGroupOptions([]);
      return;
    }
    fetch(`/api/corp-admin/cohort-groups?cohortId=${cohortId}`)
      .then((r) => r.json())
      .then((data) => {
        const options = Array.isArray(data)
          ? data
              .map((row) => ({
                id: typeof row?.id === "string" ? row.id : "",
                name: typeof row?.name === "string" ? row.name : "",
              }))
              .filter((row) => row.id && row.name)
          : [];
        setGroupOptions(options);
      })
      .catch(() => setGroupOptions([]));
  }, [cohortId, groupingEnabled]);

  useEffect(() => {
    if (!cohortId) {
      setSeatsUsed(0);
      setSeatCount(0);
      return;
    }
    fetch(`/api/corp-admin/cohort-overview?cohortId=${cohortId}`)
      .then((r) => r.json())
      .then((data) => {
        setSeatsUsed(Number(data?.invitees ?? 0));
        setSeatCount(Number(data?.seatCount ?? 0));
      })
      .catch(() => {
        setSeatsUsed(0);
        setSeatCount(0);
      });
  }, [cohortId]);

  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(users.map((u) => u.id)));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || u.assessmentStatus === statusFilter;
    const matchesGroup =
      !groupingEnabled ||
      groupFilter === "all" ||
      (groupFilter === "grouped" ? !!u.group : !u.group);
    return matchesSearch && matchesStatus && matchesGroup;
  });

  const hasActiveFilters = statusFilter !== "all" || (groupingEnabled && groupFilter !== "all");

  const handleExport = () => {
    const rows: Array<Array<string>> = [
      groupingEnabled
        ? ["Name", "Email", "Assessment Status", "Group"]
        : ["Name", "Email", "Assessment Status"],
      ...filtered.map((user) =>
        groupingEnabled
          ? [user.name, user.email, user.assessmentStatus, user.group ?? ""]
          : [user.name, user.email, user.assessmentStatus]
      ),
    ];
    const mode = tab === "reviewers" && reviewersEnabled ? "reviewers" : "users";
    downloadCsv(
      `${mode}-roster-${sanitizeCsvFilename(cohortId || "cohort")}.csv`,
      toCsv(rows)
    );
  };

  const openEditModal = (user: CohortMemberRow) => {
    setEditUserId(user.id);
    setEditName(user.name === "—" ? "" : user.name);
    setEditEmail(user.email === "—" ? "" : user.email);
    setEditGroupId(user.groupId ?? "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!cohortId || !editUserId) return;
    setEditSaving(true);
    setTableMessage(null);
    const currentRole = tab === "reviewers" && reviewersEnabled ? "reviewer" : "user";
    try {
      const res = await fetch("/api/corp-admin/cohort-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          userId: editUserId,
          role: currentRole,
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          groupId: groupingEnabled ? (editGroupId || null) : null,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to update member");
      setEditOpen(false);
      setTableMessage(`${currentRole === "reviewer" ? "Reviewer" : "User"} updated.`);
      await loadUsers();
    } catch (error) {
      setTableMessage(error instanceof Error ? error.message : "Failed to update member.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">Filter Rows</DialogTitle>
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
            {groupingEnabled ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#004070]">Group</label>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter((e.target.value as GroupFilter) ?? "all")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
                >
                  <option value="all">All</option>
                  <option value="grouped">Grouped</option>
                  <option value="ungrouped">Ungrouped</option>
                </select>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  if (groupingEnabled) setGroupFilter("all");
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
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">
            Edit {tab === "reviewers" && reviewersEnabled ? "Reviewer" : "User"}
          </DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Email</label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="text-xs" />
            </div>
            {groupingEnabled ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#004070]">Group</label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
                >
                  <option value="">No group</option>
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={editSaving || !editUserId}
                className="bg-[#004070] text-white hover:bg-[#003560]"
              >
                {editSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CardHeader className="pb-2">
        <div className="relative flex items-center justify-center">
          <Link
            href={reviewersEnabled && tab === "reviewers" ? "/corp-admin/reviewers" : "/corp-admin/users"}
            className="absolute left-0 text-muted-foreground hover:text-[#004070]"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <CardTitle className="text-base text-[#004070]">
            {reviewersEnabled && tab === "reviewers" ? "Manage Reviewers" : "Manage Users"}
          </CardTitle>
          <div className="absolute right-0 inline-flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setTab("users")}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium text-[#004070] transition-colors ${
                tab === "users" ? "bg-white shadow-sm" : "hover:bg-gray-200"
              }`}
            >
              Users
            </button>
            {reviewersEnabled ? (
              <button
                onClick={() => setTab("reviewers")}
                className={`rounded-lg px-4 py-1.5 text-xs font-medium text-[#004070] transition-colors ${
                  tab === "reviewers" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                }`}
              >
                Reviewers
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
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
          {groupingEnabled ? (
            <AssignGroupDialog
              cohortId={cohortId}
              selectedUserIds={[...selected]}
              role={tab === "reviewers" && reviewersEnabled ? "reviewer" : "user"}
              onAssigned={loadUsers}
            />
          ) : null}
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
        {tab === "users" ? (
          <p className="text-xs text-[#534F4F]">Seats used: {seatsUsed}/{seatCount}</p>
        ) : null}
        {tableMessage ? <p className="text-xs text-[#004070]">{tableMessage}</p> : null}
        {/* Table */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {cohortId
                ? `No ${tab} found in this cohort.`
                : "Select a template to view users."}
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
                    <span className="flex items-center gap-1">
                      Invitee <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">
                    <span className="flex items-center gap-1">
                      Email <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#004070]">Assessment Status</TableHead>
                  {groupingEnabled ? (
                    <TableHead className="text-xs font-medium text-[#004070]">Group</TableHead>
                  ) : null}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow
                    key={user.id}
                    className={selected.has(user.id) ? "bg-[#00ABEB]/10" : ""}
                  >
                    <TableCell className="px-2">
                      <input
                        type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={() => toggleRow(user.id)}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#004070]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-[#004070]">
                          {initials(user.name)}
                        </span>
                        <span className="text-xs text-[#004070]">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-[#004070]">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-[#004070]">
                      {user.assessmentStatus}
                    </TableCell>
                    {groupingEnabled ? (
                      <TableCell className="text-xs text-[#004070]">{user.group ?? "—"}</TableCell>
                    ) : null}
                    <TableCell>
                      <button
                        onClick={() => openEditModal(user)}
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
        </div>
      </CardContent>
    </Card>
  );
}
