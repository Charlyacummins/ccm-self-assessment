import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ROLE_PRIORITY } from "@/lib/active-role-cookie";

type InviteRole = "user" | "reviewer";
type InviteRoleFilter = InviteRole | "all";
const DEFAULT_INVITE_REDIRECT_URL = "https://ccm-self-assessment-staging.vercel.app/signup";
const ACTIVE_ASSESSMENT_STATUSES = ["invited", "accepted", "in_progress"];

type InviteResponseStatus =
  | "invited"
  | "resent"
  | "already_invited"
  | "already_member"
  | "added_member";

export type PendingInviteRow = {
  id: string;
  email: string;
  role: InviteRole;
  invited_at: string | null;
};

function normalizeRole(value: unknown): InviteRole | null {
  if (value === "user" || value === "reviewer") return value;
  return null;
}

function normalizeRoleFilter(value: unknown): InviteRoleFilter {
  if (value === "all") return "all";
  return normalizeRole(value) ?? "user";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClerkErrorDetails(error: unknown): { message: string; status: number } {
  if (error && typeof error === "object") {
    const maybe = error as {
      status?: number;
      errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
      message?: string;
    };

    const first = maybe.errors?.[0];
    const detailedMessage =
      first?.longMessage ||
      first?.message ||
      maybe.message ||
      "Failed to create invitation";
    const status = typeof maybe.status === "number" ? maybe.status : 500;

    return { message: detailedMessage, status };
  }

  return {
    message: error instanceof Error ? error.message : "Failed to create invitation",
    status: 500,
  };
}

async function upsertResolvedMemberships(params: {
  supabase: ReturnType<typeof db>;
  profileId: string;
  cohortId: string;
  corporationId: string;
  organizationId: string;
  role: InviteRole;
  addedBy: string;
}) {
  const {
    supabase,
    profileId,
    cohortId,
    corporationId,
    organizationId,
    role,
    addedBy,
  } = params;

  const orgRole = role === "reviewer" ? "reviewer" : "user";

  // Only upsert org_memberships if the new role is same or higher privilege than existing
  const { data: existingOrgMembership } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", profileId)
    .eq("org_id", organizationId)
    .maybeSingle();

  const existingPriority = ROLE_PRIORITY[existingOrgMembership?.role ?? ""] ?? 0;
  const newPriority = ROLE_PRIORITY[orgRole] ?? 0;

  if (newPriority >= existingPriority) {
    const { error: orgMembershipError } = await supabase
      .from("org_memberships")
      .upsert(
        { user_id: profileId, org_id: organizationId, role: orgRole },
        { onConflict: "user_id,org_id" }
      );
    if (orgMembershipError) throw new Error(orgMembershipError.message);
  }

  const { data: existingCorpMembership } = await supabase
    .from("corp_memberships")
    .select("role")
    .eq("user_id", profileId)
    .eq("corporation_id", corporationId)
    .maybeSingle();

  // Don't downgrade an existing corp_admin (or other high-privilege) corp membership to employee
  if (existingCorpMembership?.role !== "corp_admin") {
    const { error: corpMembershipError } = await supabase
      .from("corp_memberships")
      .upsert(
        { user_id: profileId, corporation_id: corporationId, role: "employee" },
        { onConflict: "user_id,corporation_id" }
      );
    if (corpMembershipError) throw new Error(corpMembershipError.message);
  }

  const { data: existingCohortMember, error: existingCohortMemberError } = await supabase
    .from("cohort_members")
    .select("user_id, role")
    .eq("cohort_id", cohortId)
    .eq("user_id", profileId)
    .maybeSingle();

  if (existingCohortMemberError) throw new Error(existingCohortMemberError.message);

  if (existingCohortMember) {
    if (existingCohortMember.role === "corp_admin") {
      // Don't overwrite their admin role — mark as also_participant instead
      const { error: participantError } = await supabase
        .from("cohort_members")
        .update({ also_participant: true, participant_type: role })
        .eq("cohort_id", cohortId)
        .eq("user_id", profileId);
      if (participantError) throw new Error(participantError.message);
    } else {
      const { error: updateCohortMemberError } = await supabase
        .from("cohort_members")
        .update({ role, added_by: addedBy })
        .eq("cohort_id", cohortId)
        .eq("user_id", profileId);
      if (updateCohortMemberError) throw new Error(updateCohortMemberError.message);
    }
    return;
  }

  const { error: insertCohortMemberError } = await supabase
    .from("cohort_members")
    .insert({
      cohort_id: cohortId,
      user_id: profileId,
      role,
      added_at: new Date().toISOString(),
      added_by: addedBy,
    });

  if (insertCohortMemberError) throw new Error(insertCohortMemberError.message);
}

async function ensureInvitedAssessment(params: {
  supabase: ReturnType<typeof db>;
  profileId: string;
  templateId: string | null;
}) {
  const { supabase, profileId, templateId } = params;
  if (!templateId) return;

  const { data: existing } = await supabase
    .from("assessments")
    .select("id")
    .eq("user_id", profileId)
    .eq("template_id", templateId)
    .in("status", ACTIVE_ASSESSMENT_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("assessments").insert({
    user_id: profileId,
    template_id: templateId,
    status: "invited",
  });
  if (error) throw new Error(error.message);
}

function buildResponse(status: InviteResponseStatus, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, status, ...extra });
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  const roleFilter = normalizeRoleFilter(searchParams.get("role"));
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

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

  let query = supabase
    .from("pending_invites")
    .select("id, email, role, invited_at")
    .eq("cohort_id", cohortId)
    .order("invited_at", { ascending: false });
  if (roleFilter !== "all") {
    query = query.eq("role", roleFilter);
  }
  const { data: pendingInvites, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((pendingInvites ?? []) satisfies PendingInviteRow[]);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
  const email = normalizeEmail(body?.email);
  const role = normalizeRole(body?.role);

  if (!cohortId || !inviteId || !email || !role) {
    return NextResponse.json(
      { error: "cohortId, inviteId, email, and role are required" },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
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

  const { error } = await supabase
    .from("pending_invites")
    .update({
      email,
      role,
      invited_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("cohort_id", cohortId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const corporationId = typeof body?.corporationId === "string" ? body.corporationId : "";
  const email = normalizeEmail(body?.email);
  const name = normalizeName(body?.name);
  const role = normalizeRole(body?.role);
  const resend = body?.resend === true;

  if (!cohortId || !corporationId || !email || !name || !role) {
    return NextResponse.json(
      { error: "cohortId, corporationId, email, name, and role are required" },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const supabase = db();
  const redirectUrl =
    process.env.CLERK_INVITE_REDIRECT_URL?.trim() || DEFAULT_INVITE_REDIRECT_URL;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, admin_id, company_id, payment_status, template_id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();

  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (cohort.company_id !== corporationId) {
    return NextResponse.json({ error: "cohort/corporation mismatch" }, { status: 403 });
  }

  if (cohort.payment_status !== "paid") {
    return NextResponse.json(
      { error: "These features are blocked until cohort payment has been confirmed." },
      { status: 403 }
    );
  }

  const { data: corpAdminMembership } = await supabase
    .from("corp_memberships")
    .select("user_id")
    .eq("user_id", profile.id)
    .eq("corporation_id", corporationId)
    .eq("role", "corp_admin")
    .maybeSingle();

  if (!corpAdminMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: corporation } = await supabase
    .from("corporations")
    .select("id, org_id, name, external_id")
    .eq("id", corporationId)
    .maybeSingle();

  if (!corporation) {
    return NextResponse.json({ error: "Corporation not found" }, { status: 404 });
  }
  if (!corporation.org_id) {
    return NextResponse.json({ error: "Corporation org mapping not found" }, { status: 500 });
  }

  const { data: inviteeProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (inviteeProfile) {
    const { data: existingCohortMember } = await supabase
      .from("cohort_members")
      .select("user_id, role")
      .eq("cohort_id", cohortId)
      .eq("user_id", inviteeProfile.id)
      .maybeSingle();

    if (existingCohortMember?.role === role) {
      return buildResponse("already_member");
    }

    await upsertResolvedMemberships({
      supabase,
      profileId: inviteeProfile.id,
      cohortId,
      corporationId,
      organizationId: corporation.org_id,
      role,
      addedBy: profile.id,
    });

    await supabase
      .from("pending_invites")
      .delete()
      .eq("email", email)
      .eq("cohort_id", cohortId);

    if (role === "user") {
      await ensureInvitedAssessment({
        supabase,
        profileId: inviteeProfile.id,
        templateId: cohort.template_id ?? null,
      });
    }

    return buildResponse("added_member");
  }

  const { data: existingPending } = await supabase
    .from("pending_invites")
    .select("id, role")
    .eq("email", email)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  if (existingPending && !resend) {
    return buildResponse("already_invited", { canResend: true });
  }

  const { error: pendingInviteError } = await supabase
    .from("pending_invites")
    .upsert(
      {
        email,
        cohort_id: cohortId,
        role,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "email,cohort_id" }
    );

  if (pendingInviteError) {
    return NextResponse.json({ error: pendingInviteError.message }, { status: 500 });
  }

  const clerk = await clerkClient();

  try {
    await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl,
      publicMetadata: {
        organizationId: corporation.org_id,
        corporationId: corporation.id,
        corporationName: corporation.name ?? null,
        corporationExternalId: corporation.external_id ?? null,
        cohortId,
        inviteRole: role,
        addedBy: profile.id,
        name,
      },
    });
  } catch (error) {
    const { message, status } = getClerkErrorDetails(error);
    console.error("corp-admin invite failed", {
      email,
      cohortId,
      corporationId,
      role,
      redirectUrl,
      status,
      message,
      raw: error,
    });
    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }

  return buildResponse(existingPending ? "resent" : "invited");
}
