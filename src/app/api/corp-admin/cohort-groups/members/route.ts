import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type GroupMemberRow = {
  id: string;
  name: string;
  email: string;
  role: "user" | "reviewer" | "corp_admin";
  assessmentStatus: "Completed" | "Active" | "Invited" | "Accepted";
};

const COMPLETED_STATUSES = ["submitted", "in_review", "reviewed", "completed"];

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  const groupId = searchParams.get("groupId");
  if (!cohortId || !groupId) {
    return NextResponse.json({ error: "cohortId and groupId are required" }, { status: 400 });
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

  const { data: settings } = await supabase
    .from("cohort_settings")
    .select("grouping_enabled")
    .eq("cohort_id", cohortId)
    .maybeSingle();
  if (!settings?.grouping_enabled) {
    return NextResponse.json({ error: "Grouping is disabled for this cohort" }, { status: 403 });
  }

  const { data: group } = await supabase
    .from("cohort_groups")
    .select("id")
    .eq("id", groupId)
    .eq("cohort_id", cohortId)
    .maybeSingle();
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const { data: members } = await supabase
    .from("cohort_members")
    .select("user_id, role")
    .eq("cohort_id", cohortId)
    .eq("group_id", groupId)
    .in("role", ["user", "reviewer"]);

  if (!members || members.length === 0) return NextResponse.json([] satisfies GroupMemberRow[]);

  const userIds = members.map((m) => m.user_id);

  const [{ data: profiles }, { data: assessments }, { data: pendingInvites }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", userIds),
    supabase.from("assessments").select("user_id, status").in("user_id", userIds),
    supabase.from("pending_invites").select("email").eq("cohort_id", cohortId).in("role", ["user", "reviewer"]),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const pendingInviteEmailSet = new Set(
    (pendingInvites ?? [])
      .map((invite) => invite.email?.trim().toLowerCase())
      .filter((email): email is string => !!email)
  );

  const assessmentStatusMap: Record<string, string> = {};
  for (const assessment of assessments ?? []) {
    const existing = assessmentStatusMap[assessment.user_id];
    if (!existing || COMPLETED_STATUSES.includes(assessment.status)) {
      assessmentStatusMap[assessment.user_id] = assessment.status;
    }
  }

  const rows: GroupMemberRow[] = members.map((member) => {
    const p = profileMap[member.user_id];
    const rawStatus = assessmentStatusMap[member.user_id];
    const normalizedEmail = p?.email?.trim().toLowerCase() ?? "";

    let assessmentStatus: GroupMemberRow["assessmentStatus"];
    if (!rawStatus) {
      assessmentStatus =
        normalizedEmail && pendingInviteEmailSet.has(normalizedEmail) ? "Invited" : "Accepted";
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
      id: member.user_id,
      name: p?.full_name ?? "—",
      email: p?.email ?? "—",
      role: member.role,
      assessmentStatus,
    };
  });

  return NextResponse.json(rows);
}
