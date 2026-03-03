import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type CohortMemberRow = {
  id: string;
  name: string;
  email: string;
  assessmentStatus: "Completed" | "Active" | "Invited" | "Accepted";
  group: string | null;
};

const COMPLETED_STATUSES = ["submitted", "in_review", "reviewed", "completed"];

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

  const [{ data: profiles }, { data: assessments }, { data: pendingInvites }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", userIds),
    supabase.from("assessments").select("user_id, status").in("user_id", userIds),
    supabase
      .from("pending_invites")
      .select("email")
      .eq("cohort_id", cohortId)
      .eq("role", role),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const pendingInviteEmailSet = new Set(
    (pendingInvites ?? [])
      .map((invite) => invite.email?.trim().toLowerCase())
      .filter((email): email is string => !!email)
  );

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
      group: m.group_id ?? null,
    };
  });

  return NextResponse.json(rows);
}
