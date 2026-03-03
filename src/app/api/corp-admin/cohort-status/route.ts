import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type CohortStatus = "draft" | "active" | "completed";

const COMPLETED_ASSESSMENT_STATUSES = ["submitted", "in_review", "reviewed", "completed"];

function normalizeStatus(value: unknown): CohortStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "draft" ||
    normalized === "active" ||
    normalized === "completed" ||
    normalized === "ended"
  ) {
    if (normalized === "ended") return "completed";
    return normalized;
  }
  return null;
}

function isValidTransition(current: CohortStatus, next: CohortStatus): boolean {
  if (current === next) return true;
  if (current === "draft") return next === "active";
  if (current === "active") return next === "completed";
  return false;
}

function toDbStatus(status: CohortStatus): "Draft" | "Active" | "Completed" {
  if (status === "draft") return "Draft";
  if (status === "active") return "Active";
  return "Completed";
}

async function getUncompletedInviteeCount(params: {
  supabase: ReturnType<typeof db>;
  cohortId: string;
  templateId: string | null;
}) {
  const { supabase, cohortId, templateId } = params;
  const { data: members } = await supabase
    .from("cohort_members")
    .select("user_id")
    .eq("cohort_id", cohortId)
    .eq("role", "user");

  const userIds = (members ?? []).map((member) => member.user_id);
  if (!userIds.length) return 0;

  let assessmentsQuery = supabase
    .from("assessments")
    .select("user_id, status")
    .in("user_id", userIds);

  if (templateId) {
    assessmentsQuery = assessmentsQuery.eq("template_id", templateId);
  }

  const { data: assessments } = await assessmentsQuery;

  const completedUserIds = new Set<string>();
  for (const assessment of assessments ?? []) {
    if (
      typeof assessment.status === "string" &&
      COMPLETED_ASSESSMENT_STATUSES.includes(assessment.status)
    ) {
      completedUserIds.add(assessment.user_id);
    }
  }

  return userIds.filter((userId) => !completedUserIds.has(userId)).length;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const nextStatus = normalizeStatus(body?.status);
  const force = body?.force === true;

  if (!cohortId || !nextStatus) {
    return NextResponse.json({ error: "cohortId and status are required" }, { status: 400 });
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
    .select("id, admin_id, status, template_id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();

  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const currentStatus = normalizeStatus(cohort.status ?? "draft");
  if (!currentStatus) {
    return NextResponse.json({ error: "Current cohort status is invalid" }, { status: 400 });
  }
  if (!isValidTransition(currentStatus, nextStatus)) {
    return NextResponse.json(
      { error: `Invalid cohort status transition: ${currentStatus} -> ${nextStatus}` },
      { status: 400 }
    );
  }

  if (currentStatus === "active" && nextStatus === "completed") {
    const uncompletedInvitees = await getUncompletedInviteeCount({
      supabase,
      cohortId,
      templateId: cohort.template_id ?? null,
    });

    if (uncompletedInvitees > 0 && !force) {
      return NextResponse.json(
        {
          error: "Uncompleted assessments remain",
          needsConfirmation: true,
          uncompletedInvitees,
        },
        { status: 409 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("cohorts")
    .update({ status: toDbStatus(nextStatus) })
    .eq("id", cohortId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: nextStatus });
}
