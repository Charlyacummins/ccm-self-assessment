"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Download,
  Trash2,
  Users,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Pencil,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { CohortMemberRow } from "@/app/api/corp-admin/cohort-members/route";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

type Tab = "users" | "reviewers";

export function ManageUsersTable({ cohortId }: { cohortId: string }) {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<CohortMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!cohortId) return;
    setLoading(true);
    setSelected(new Set());
    const role = tab === "reviewers" ? "reviewer" : "user";
    fetch(`/api/corp-admin/cohort-members?cohortId=${cohortId}&role=${role}`)
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [cohortId, tab]);

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

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="relative flex items-center justify-center">
          <Link
            href={tab === "reviewers" ? "/corp-admin/reviewers" : "/corp-admin/users"}
            className="absolute left-0 text-muted-foreground hover:text-[#004070]"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <CardTitle className="text-base text-[#004070]">
            {tab === "reviewers" ? "Manage Reviewers" : "Manage Users"}
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
            <button
              onClick={() => setTab("reviewers")}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium text-[#004070] transition-colors ${
                tab === "reviewers" ? "bg-white shadow-sm" : "hover:bg-gray-200"
              }`}
            >
              Reviewers
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-md border p-2 text-muted-foreground hover:bg-gray-50">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <Button variant="outline" size="sm" className="gap-1.5 border-gray-200 text-xs text-[#004070]">
            <Bell className="h-3.5 w-3.5" /> Reminder
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-gray-200 text-xs text-[#004070]">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-gray-200 text-xs text-[#004070]">
            <Trash2 className="h-3.5 w-3.5" /> Revoke
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-gray-200 text-xs text-[#004070]">
            <Users className="h-3.5 w-3.5" /> Group
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
                  <TableHead className="text-xs font-medium text-[#004070]">Group</TableHead>
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
                    <TableCell className="text-xs text-[#004070]">{user.group ?? "—"}</TableCell>
                    <TableCell>
                      <button className="flex items-center gap-1 text-xs text-[#004070] hover:text-[#00ABEB]">
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
