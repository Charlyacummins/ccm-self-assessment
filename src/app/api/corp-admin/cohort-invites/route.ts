import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type InviteRole = "user" | "reviewer";
const DEFAULT_INVITE_REDIRECT_URL = "https://ccm-self-assessment-staging.vercel.app";

type InviteResponseStatus =
  | "invited"
  | "resent"
  | "already_invited"
  | "already_member"
  | "added_member";

function normalizeRole(value: unknown): InviteRole | null {
  if (value === "user" || value === "reviewer") return value;
  return null;
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
  const { error: orgMembershipError } = await supabase
    .from("org_memberships")
    .upsert(
      {
        user_id: profileId,
        org_id: organizationId,
        role: orgRole,
      },
      { onConflict: "user_id,org_id" }
    );

  if (orgMembershipError) throw new Error(orgMembershipError.message);

  const { error: corpMembershipError } = await supabase
    .from("corp_memberships")
    .upsert(
      {
        user_id: profileId,
        corporation_id: corporationId,
        role: "user",
      },
      { onConflict: "user_id,corporation_id" }
    );

  if (corpMembershipError) throw new Error(corpMembershipError.message);

  const { data: existingCohortMember, error: existingCohortMemberError } = await supabase
    .from("cohort_members")
    .select("user_id, role")
    .eq("cohort_id", cohortId)
    .eq("user_id", profileId)
    .maybeSingle();

  if (existingCohortMemberError) throw new Error(existingCohortMemberError.message);

  if (existingCohortMember) {
    const { error: updateCohortMemberError } = await supabase
      .from("cohort_members")
      .update({
        role,
        status: "active",
        added_by: addedBy,
      })
      .eq("cohort_id", cohortId)
      .eq("user_id", profileId);

    if (updateCohortMemberError) throw new Error(updateCohortMemberError.message);
    return;
  }

  const { error: insertCohortMemberError } = await supabase
    .from("cohort_members")
    .insert({
      cohort_id: cohortId,
      user_id: profileId,
      role,
      status: "active",
      added_at: new Date().toISOString(),
      added_by: addedBy,
    });

  if (insertCohortMemberError) throw new Error(insertCohortMemberError.message);
}

function buildResponse(status: InviteResponseStatus, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, status, ...extra });
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
    .select("id, admin_id, company_id, payment_status")
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
