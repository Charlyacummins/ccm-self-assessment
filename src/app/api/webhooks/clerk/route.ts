import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

type InviteRole = "user" | "reviewer";

function normalizeEmail(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function parseInviteRole(value: unknown): InviteRole {
  return value === "reviewer" ? "reviewer" : "user";
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function upsertOrgMembership(
  supabase: ReturnType<typeof db>,
  userId: string,
  orgId: string,
  role: InviteRole
) {
  const { data: existing, error: existingError } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing?.role === "admin" || existing?.role === "corp_admin") {
    return;
  }

  const nextRole =
    existing?.role === "reviewer" || role === "reviewer" ? "reviewer" : "user";

  const { error } = await supabase
    .from("org_memberships")
    .upsert(
      {
        user_id: userId,
        org_id: orgId,
        role: nextRole,
      },
      { onConflict: "user_id,org_id" }
    );

  if (error) throw new Error(error.message);
}

async function upsertCorpMembership(
  supabase: ReturnType<typeof db>,
  userId: string,
  corporationId: string
) {
  const { data: existing, error: existingError } = await supabase
    .from("corp_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("corporation_id", corporationId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.role === "corp_admin") return;

  const { error } = await supabase
    .from("corp_memberships")
    .upsert(
      {
        user_id: userId,
        corporation_id: corporationId,
        role: "employee",
      },
      { onConflict: "user_id,corporation_id" }
    );

  if (error) throw new Error(error.message);
}

async function upsertCohortMember(
  supabase: ReturnType<typeof db>,
  userId: string,
  cohortId: string,
  role: InviteRole
) {
  const { data: existing, error: existingError } = await supabase
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", cohortId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error: updateError } = await supabase
      .from("cohort_members")
      .update({
        role,
        status: "active",
      })
      .eq("cohort_id", cohortId)
      .eq("user_id", userId);

    if (updateError) throw new Error(updateError.message);
    return;
  }

  const { error: insertError } = await supabase
    .from("cohort_members")
    .insert({
      cohort_id: cohortId,
      user_id: userId,
      role,
      status: "active",
      added_at: new Date().toISOString(),
    });

  if (insertError) throw new Error(insertError.message);
}

export async function POST(req: Request) {
  const payload = await req.text();

  const svixId = req.headers.get("svix-id");
  const svixTs = req.headers.get("svix-timestamp");
  const svixSig = req.headers.get("svix-signature");
  if (!svixId || !svixTs || !svixSig) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  let evt: WebhookEvent;
  try {
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTs,
      "svix-signature": svixSig,
    }) as WebhookEvent;
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const supabase = db();

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const u = evt.data;
        const metadataName = parseString(u.public_metadata?.name);
        const resolvedFullName =
          [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || metadataName || null;
        const profileId = await supabase.rpc("upsert_profile", {
          p_clerk_user_id: u.id,
          p_full_name: resolvedFullName,
          p_email: u.email_addresses?.[0]?.email_address ?? null,
        });

        // Sync org memberships from Clerk
        const clerk = await clerkClient();
        const memberships = await clerk.users.getOrganizationMembershipList({
          userId: u.id,
        });

        for (const membership of memberships.data) {
          // Look up org in Supabase by slug
          const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", membership.organization.slug)
            .single();

          if (org) {
            await upsertOrgMembership(supabase, profileId.data, org.id, "user");
          }
        }

        // Handle cohort invite reconciliation (skip for provisioned admins)
        const isProvisionedAdmin = u.public_metadata?.role === "corp:admin";
        if (!isProvisionedAdmin) {
          const email = normalizeEmail(u.email_addresses?.[0]?.email_address);
          const { data: pendingInvites } = email
            ? await supabase
                .from("pending_invites")
                .select("id, cohort_id, role")
                .eq("email", email)
            : { data: [] as Array<{ id: string; cohort_id: string | null; role: string }> };

          const metadataCohortId = parseString(u.public_metadata?.cohortId);
          const metadataInviteRole = parseInviteRole(u.public_metadata?.inviteRole);

          const invitesToProcess =
            (pendingInvites?.length ?? 0) > 0
              ? (pendingInvites ?? [])
              : metadataCohortId
                ? [
                    {
                      id: "metadata-fallback",
                      cohort_id: metadataCohortId,
                      role: metadataInviteRole,
                    },
                  ]
                : [];

          if (invitesToProcess.length > 0) {
            const cohortIds = [...new Set(
              invitesToProcess
                .map((invite) => invite.cohort_id)
                .filter((value): value is string => typeof value === "string" && value.length > 0)
            )];

            const { data: cohorts } = cohortIds.length
              ? await supabase
                  .from("cohorts")
                  .select("id, company_id")
                  .in("id", cohortIds)
              : { data: [] as Array<{ id: string; company_id: string | null }> };

            const corporationIds = [...new Set(
              (cohorts ?? [])
                .map((cohort) => cohort.company_id)
                .filter((value): value is string => typeof value === "string" && value.length > 0)
            )];

            const { data: corporations } = corporationIds.length
              ? await supabase
                  .from("corporations")
                  .select("id, org_id")
                  .in("id", corporationIds)
              : { data: [] as Array<{ id: string; org_id: string | null }> };

            const cohortById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort]));
            const corporationById = new Map(
              (corporations ?? []).map((corporation) => [corporation.id, corporation])
            );
            const orgRoleById = new Map<string, InviteRole>();

            for (const invite of invitesToProcess) {
              const cohortId = invite.cohort_id;
              if (!cohortId) continue;

              const cohort = cohortById.get(cohortId);
              const corporationId = cohort?.company_id ?? null;
              if (!cohort || !corporationId) continue;

              const inviteRole = parseInviteRole(invite.role);
              const corporation = corporationById.get(corporationId);

              await upsertCorpMembership(supabase, profileId.data, corporationId);
              await upsertCohortMember(supabase, profileId.data, cohortId, inviteRole);

              if (corporation?.org_id) {
                const currentOrgRole = orgRoleById.get(corporation.org_id) ?? "user";
                orgRoleById.set(
                  corporation.org_id,
                  currentOrgRole === "reviewer" || inviteRole === "reviewer"
                    ? "reviewer"
                    : "user"
                );
              }
            }

            for (const [orgId, role] of orgRoleById.entries()) {
              await upsertOrgMembership(supabase, profileId.data, orgId, role);
            }
          } else {
            // No trusted pending invite: create a standard user org membership only.
            let orgId: string | null = null;
            if (u.external_accounts && u.external_accounts.length > 0) {
              const ssoProvider = u.external_accounts[0].identification_id;
              if (ssoProvider === "worldcc_sso") {
                orgId = process.env.WORLDCC_ORG_ID!;
              } else if (ssoProvider === "ncma_sso") {
                orgId = process.env.NCMA_ORG_ID!;
              } else {
                orgId = process.env.CCMI_ORG_ID!;
              }
            } else {
              orgId = process.env.CCMI_ORG_ID!;
            }

            if (orgId) {
              await upsertOrgMembership(supabase, profileId.data, orgId, "user");
            }
          }

          if (email && (pendingInvites?.length ?? 0) > 0) {
            await supabase.from("pending_invites").delete().eq("email", email);
          }
        }

        break;
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
