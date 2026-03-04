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
  ArrowUpDown,
  ChevronDown,
  Download,
  Eye,
  Plus,
  Search,
} from "lucide-react";
import type { TemplateOption } from "./manage-assessments-content";
import { downloadCsv, sanitizeCsvFilename, toCsv } from "@/lib/csv";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  completedPercentage: number;
  memberCount: number;
  completedCount: number;
};

type GroupMemberRow = {
  id: string;
  name: string;
  email: string;
  role: "user" | "reviewer" | "corp_admin";
  assessmentStatus: "Completed" | "Active" | "Invited" | "Accepted";
};

type RosterUser = {
  id: string;
  name: string;
  email: string;
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

export function GroupsContent({ templateOptions }: { templateOptions: TemplateOption[] }) {
  const [cohortId, setCohortId] = useState(templateOptions[0]?.value ?? "");
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [rosterUsers, setRosterUsers] = useState<RosterUser[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [viewOpen, setViewOpen] = useState(false);
  const [viewGroupName, setViewGroupName] = useState("");
  const [viewMembers, setViewMembers] = useState<GroupMemberRow[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadRows = async () => {
    if (!cohortId || !groupingEnabled) {
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/corp-admin/cohort-groups?cohortId=${cohortId}`);
      const data = (await res.json()) as GroupRow[] | { error?: string };
      if (!res.ok) {
        const errorMessage =
          typeof data === "object" && data && "error" in data ? (data.error ?? "Failed to load groups") : "Failed to load groups";
        throw new Error(errorMessage);
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setRows([]);
      setStatusMessage(error instanceof Error ? error.message : "Failed to load groups.");
    } finally {
      setLoading(false);
    }
  };

  const loadRosterUsers = async () => {
    if (!cohortId || !groupingEnabled) {
      setRosterUsers([]);
      return;
    }

    setRosterLoading(true);
    try {
      const res = await fetch(`/api/corp-admin/cohort-members?cohortId=${cohortId}&role=user`);
      const data = (await res.json()) as
        | Array<{ id: string; name: string; email: string }>
        | { error?: string };
      if (!res.ok) {
        const errorMessage =
          typeof data === "object" && data && "error" in data ? (data.error ?? "Failed to load roster users") : "Failed to load roster users";
        throw new Error(errorMessage);
      }

      const users = Array.isArray(data)
        ? data.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
          }))
        : [];
      setRosterUsers(users);
    } catch (error) {
      setRosterUsers([]);
      setStatusMessage(error instanceof Error ? error.message : "Failed to load roster users.");
    } finally {
      setRosterLoading(false);
    }
  };

  const loadSettings = async () => {
    if (!cohortId) {
      setGroupingEnabled(false);
      return;
    }
    setSettingsLoading(true);
    try {
      const res = await fetch(`/api/corp-admin/cohort-settings?cohortId=${cohortId}`);
      const data = (await res.json()) as { grouping_enabled?: boolean };
      setGroupingEnabled(Boolean(data?.grouping_enabled));
    } catch {
      setGroupingEnabled(false);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    setSelected(new Set());
    setSelectedUserIds(new Set());
    setStatusMessage(null);
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId]);

  useEffect(() => {
    if (!cohortId || settingsLoading) return;
    if (!groupingEnabled) {
      setRows([]);
      setRosterUsers([]);
      return;
    }
    void Promise.all([loadRows(), loadRosterUsers()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, groupingEnabled, settingsLoading]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const name = row.name.toLowerCase();
      const description = row.description?.toLowerCase() ?? "";
      return !q || name.includes(q) || description.includes(q);
    });
  }, [rows, search]);

  const summaryText = useMemo(() => {
    const totalGroups = rows.length;
    const totalMembers = rows.reduce((sum, row) => sum + row.memberCount, 0);
    const totalCompleted = rows.reduce((sum, row) => sum + row.completedCount, 0);
    return `${totalGroups} groups - ${totalMembers} members - ${totalCompleted} submitted`;
  }, [rows]);

  const filteredRosterUsers = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return rosterUsers;
    return rosterUsers.filter((user) => {
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    });
  }, [rosterUsers, rosterSearch]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.has(row.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredRows.map((row) => row.id)));
  };
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCreateGroup = async () => {
    if (!cohortId) {
      setStatusMessage("Please select a cohort first.");
      return;
    }

    const name = createName.trim();
    const description = createDescription.trim();
    if (!name) {
      setStatusMessage("Group name is required.");
      return;
    }

    setCreateSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/corp-admin/cohort-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          name,
          description: description.length > 0 ? description : null,
          memberUserIds: [...selectedUserIds],
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to create group");

      setCreateName("");
      setCreateDescription("");
      setSelectedUserIds(new Set());
      setRosterSearch("");
      setCreateOpen(false);
      setStatusMessage("Group created.");
      await loadRows();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create group.");
    } finally {
      setCreateSaving(false);
    }
  };

  const handleViewGroup = async (row: GroupRow) => {
    if (!cohortId || !groupingEnabled) return;
    setViewOpen(true);
    setViewGroupName(row.name);
    setViewMembers([]);
    setViewLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `/api/corp-admin/cohort-groups/members?cohortId=${cohortId}&groupId=${row.id}`
      );
      const data = (await res.json()) as GroupMemberRow[] | { error?: string };
      if (!res.ok) {
        const errorMessage =
          typeof data === "object" && data && "error" in data ? (data.error ?? "Failed to load group members") : "Failed to load group members";
        throw new Error(errorMessage);
      }
      setViewMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      setViewMembers([]);
      setStatusMessage(error instanceof Error ? error.message : "Failed to load group members.");
    } finally {
      setViewLoading(false);
    }
  };

  const handleExportGroups = async () => {
    if (!cohortId || !groupingEnabled || filteredRows.length === 0) return;
    setExporting(true);
    setStatusMessage(null);
    let exportedCount = 0;

    try {
      for (const group of filteredRows) {
        const res = await fetch(
          `/api/corp-admin/cohort-groups/members?cohortId=${cohortId}&groupId=${group.id}`
        );
        const payload = (await res.json()) as GroupMemberRow[] | { error?: string };
        if (!res.ok) {
          const message =
            typeof payload === "object" && payload && "error" in payload
              ? (payload.error ?? `Failed to export ${group.name}`)
              : `Failed to export ${group.name}`;
          throw new Error(message);
        }

        const members = Array.isArray(payload) ? payload : [];
        const rows: Array<Array<string>> = [
          ["Name", "Email", "Role", "Assessment Status"],
          ...members.map((member) => [
            member.name,
            member.email,
            member.role,
            member.assessmentStatus,
          ]),
        ];

        downloadCsv(`${sanitizeCsvFilename(group.name)}.csv`, toCsv(rows));
        exportedCount += 1;
      }

      setStatusMessage(`Exported ${exportedCount} group CSV file${exportedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to export groups.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="text-lg font-semibold text-[#004070]">
            {viewGroupName ? `${viewGroupName} Members` : "Group Members"}
          </DialogTitle>
          {viewLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading members...</p>
          ) : viewMembers.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No members in this group.</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-[#004070]">Name</TableHead>
                    <TableHead className="text-xs font-medium text-[#004070]">Email</TableHead>
                    <TableHead className="text-xs font-medium text-[#004070]">Role</TableHead>
                    <TableHead className="text-xs font-medium text-[#004070]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-xs text-[#004070]">{member.name}</TableCell>
                      <TableCell className="text-xs text-[#004070]">{member.email}</TableCell>
                      <TableCell className="text-xs text-[#004070] capitalize">{member.role}</TableCell>
                      <TableCell className="text-xs font-semibold text-[#004070]">
                        {member.assessmentStatus}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">Create Group</DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Name</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Senior Management"
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Description</label>
              <Input
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Optional"
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#004070]">Add Users From Roster</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Search users"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="max-h-44 overflow-y-auto rounded-md border p-2">
                {rosterLoading ? (
                  <p className="py-2 text-xs text-muted-foreground">Loading users...</p>
                ) : filteredRosterUsers.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">No users found.</p>
                ) : (
                  <div className="space-y-1">
                    {filteredRosterUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(user.id)}
                          onChange={() =>
                            setSelectedUserIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(user.id)) next.delete(user.id);
                              else next.add(user.id);
                              return next;
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 accent-[#004070]"
                        />
                        <span className="truncate text-xs text-[#004070]">
                          {user.name} ({user.email})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedUserIds.size} selected
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateGroup()}
                disabled={createSaving}
                className="bg-[#004070] text-white hover:bg-[#003560]"
              >
                {createSaving ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CohortSelector options={templateOptions} value={cohortId} onChange={setCohortId} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-base text-[#004070]">Groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!settingsLoading && !groupingEnabled ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Grouping is disabled for this cohort.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {groupingEnabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleExportGroups()}
                disabled={exporting || filteredRows.length === 0}
                className="gap-1.5 border-gray-200 text-xs text-[#004070]"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            ) : null}
            <p className="px-1 text-xs text-[#534F4F]">{summaryText}</p>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-56 pl-8 text-xs"
              />
            </div>
          </div>

          {statusMessage ? <p className="text-xs text-[#004070]">{statusMessage}</p> : null}

          {groupingEnabled ? <div className="min-h-0 overflow-y-auto">
            {loading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Loading...</p>
            ) : filteredRows.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {cohortId ? "No groups found for this cohort." : "Select a cohort to view groups."}
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
                        Group <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#004070]">
                      <span className="flex items-center gap-1">
                        Description <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#004070]">Completed %</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id} className={selected.has(row.id) ? "bg-[#00ABEB]/10" : ""}>
                      <TableCell className="px-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#004070]"
                        />
                      </TableCell>
                      <TableCell className="text-xs text-[#004070]">{row.name}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-xs text-[#004070]">
                        {row.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#004070]">
                        {row.completedPercentage}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => void handleViewGroup(row)}
                          className="flex items-center gap-1 text-xs text-[#004070] hover:text-[#00ABEB]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div> : null}

          {groupingEnabled ? <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5 bg-[#004070] text-white hover:bg-[#003560]"
            >
              <Plus className="h-4 w-4" />
              Add Group
            </Button>
          </div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
