import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type CohortMemberRow = {
  id: string;
  name: string;
  email: string;
  assessmentStatus: "Completed" | "Active" | "Invited" | "Accepted";
  group: string | null;
  groupId: string | null;
};

const COMPLETED_STATUSES = ["submitted", "in_review", "reviewed", "completed"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const role = searchParams.get("role") ?? "user";

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Verify the signed-in user is the admin for this cohort
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();

  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: members } = await supabase
    .from("cohort_members")
    .select("user_id, group_id")
    .eq("cohort_id", cohortId)
    .eq("role", role);

  if (!members || members.length === 0) return NextResponse.json([]);

  const userIds = members.map((m) => m.user_id);
  const groupIds = [...new Set(members.map((m) => m.group_id).filter((id): id is string => !!id))];

  const [{ data: profiles }, { data: assessments }, { data: pendingInvites }, { data: cohortGroups }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      supabase.from("assessments").select("user_id, status").in("user_id", userIds),
      supabase
        .from("pending_invites")
        .select("email")
        .eq("cohort_id", cohortId)
        .eq("role", role),
      groupIds.length > 0
        ? supabase
            .from("cohort_groups")
            .select("*")
            .eq("cohort_id", cohortId)
            .in("id", groupIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const pendingInviteEmailSet = new Set(
    (pendingInvites ?? [])
      .map((invite) => invite.email?.trim().toLowerCase())
      .filter((email): email is string => !!email)
  );
  const groupNameById = new Map<string, string>();
  for (const group of cohortGroups ?? []) {
    const rawId = group.id ?? group.group_id;
    const groupId =
      typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : null;
    const rawName = group.name ?? group.group_name;
    const groupName = typeof rawName === "string" ? rawName : null;
    if (groupId && groupName) {
      groupNameById.set(groupId, groupName);
    }
  }

  const assessmentStatusMap: Record<string, string> = {};
  for (const a of assessments ?? []) {
    const existing = assessmentStatusMap[a.user_id];
    if (!existing || COMPLETED_STATUSES.includes(a.status)) {
      assessmentStatusMap[a.user_id] = a.status;
    }
  }

  const rows: CohortMemberRow[] = members.map((m) => {
    const p = profileMap[m.user_id];
    const rawStatus = assessmentStatusMap[m.user_id];
    const email = p?.email ?? "—";
    const normalizedEmail = p?.email?.trim().toLowerCase() ?? "";

    let assessmentStatus: CohortMemberRow["assessmentStatus"];
    if (!rawStatus) {
      assessmentStatus =
        normalizedEmail && pendingInviteEmailSet.has(normalizedEmail)
          ? "Invited"
          : "Accepted";
    } else if (COMPLETED_STATUSES.includes(rawStatus)) {
      assessmentStatus = "Completed";
    } else if (rawStatus === "accepted") {
      assessmentStatus = "Accepted";
    } else if (rawStatus === "invited") {
      assessmentStatus = "Invited";
    } else {
      assessmentStatus = "Active";
    }

    return {
      id: m.user_id,
      name: p?.full_name ?? "—",
      email,
      assessmentStatus,
      group: m.group_id ? (groupNameById.get(m.group_id) ?? null) : null,
      groupId: m.group_id ?? null,
    };
  });

  return NextResponse.json(rows);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";
  const role = body?.role === "user" || body?.role === "reviewer" ? body.role : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const groupId =
    body?.groupId === null ? null : typeof body?.groupId === "string" ? body.groupId : undefined;

  if (!cohortId || !targetUserId || !name || !email) {
    return NextResponse.json(
      { error: "cohortId, userId, name, and email are required" },
      { status: 400 }
    );
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const supabase = db();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();
  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: member } = await supabase
    .from("cohort_members")
    .select("cohort_id, user_id, role")
    .eq("cohort_id", cohortId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (role && member.role !== role) {
    return NextResponse.json({ error: "Member role mismatch" }, { status: 400 });
  }

  if (groupId !== undefined) {
    const { data: settings } = await supabase
      .from("cohort_settings")
      .select("grouping_enabled")
      .eq("cohort_id", cohortId)
      .maybeSingle();
    if (!settings?.grouping_enabled && groupId !== null) {
      return NextResponse.json(
        { error: "Grouping is disabled for this cohort" },
        { status: 403 }
      );
    }

    if (groupId) {
      const { data: group } = await supabase
        .from("cohort_groups")
        .select("id")
        .eq("id", groupId)
        .eq("cohort_id", cohortId)
        .maybeSingle();
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: name,
      email,
    })
    .eq("id", targetUserId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const updates: { group_id?: string | null } = {};
  if (groupId !== undefined) {
    updates.group_id = groupId;
  }

  if (Object.keys(updates).length > 0) {
    const { error: memberError } = await supabase
      .from("cohort_members")
      .update(updates)
      .eq("cohort_id", cohortId)
      .eq("user_id", targetUserId);
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
