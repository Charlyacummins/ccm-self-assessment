import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const email = normalizeEmail(body?.email);

  if (!cohortId || !email) {
    return NextResponse.json({ error: "cohortId and email are required" }, { status: 400 });
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

  // Revoke active Clerk invitations for this email + cohort metadata.
  const clerk = await clerkClient();
  let clerkRevokedCount = 0;
  let clerkError: string | null = null;
  try {
    const invitations = await clerk.invitations.getInvitationList({
      status: "pending",
      query: email,
      limit: 100,
    });

    const matches = invitations.data.filter((invitation) => {
      const invitationEmail = invitation.emailAddress?.trim().toLowerCase();
      const metadataCohortId =
        typeof invitation.publicMetadata?.cohortId === "string"
          ? invitation.publicMetadata.cohortId
          : null;
      return invitationEmail === email && metadataCohortId === cohortId;
    });

    for (const invitation of matches) {
      await clerk.invitations.revokeInvitation(invitation.id);
      clerkRevokedCount += 1;
    }
  } catch (error) {
    clerkError = error instanceof Error ? error.message : "Failed to revoke Clerk invitation";
  }

  const { count: existingCount } = await supabase
    .from("pending_invites")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .eq("email", email);

  const { error: deleteError } = await supabase
    .from("pending_invites")
    .delete()
    .eq("cohort_id", cohortId)
    .eq("email", email);

  if (deleteError && clerkError) {
    return NextResponse.json({ error: deleteError.message, clerkError }, { status: 500 });
  }

  if (clerkError) {
    return NextResponse.json({
      ok: true,
      status: (existingCount ?? 0) > 0 ? "revoked_with_clerk_warning" : "not_found_with_clerk_warning",
      clerkError,
      clerkRevokedCount,
    });
  }

  return NextResponse.json({
    ok: true,
    status: (existingCount ?? 0) > 0 ? "revoked" : "not_found",
    clerkRevokedCount,
  });
}
