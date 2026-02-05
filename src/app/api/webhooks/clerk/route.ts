import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

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
        const profileId = await supabase.rpc("upsert_profile", {
          p_clerk_user_id: u.id,
          p_full_name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
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
            await supabase
              .from("org_memberships")
              .upsert(
                {
                  user_id: profileId.data,
                  org_id: org.id,
                  role: null,
                },
                { onConflict: "user_id,org_id" }
              );
          }
        }

        // Handle new user setup (only on user creation)
        if (evt.type === "user.created") {
          // Determine org_id
          let orgId: string | null = null;

          // Priority 1: From cohort invitation metadata
          if (u.public_metadata?.organizationId) {
            orgId = u.public_metadata.organizationId as string;
          }
          // Priority 2: From SSO connection
          else if (u.external_accounts && u.external_accounts.length > 0) {
            const ssoProvider = u.external_accounts[0].identification_id;
            if (ssoProvider === "worldcc_sso") {
              orgId = process.env.WORLDCC_ORG_ID!;
            } else if (ssoProvider === "ncma_sso") {
              orgId = process.env.NCMA_ORG_ID!;
            }
          }
          // Priority 3: Default to CCMI for regular signups
          else {
            orgId = process.env.CCMI_ORG_ID!;
          }

          if (orgId) {
            await supabase
              .from("org_memberships")
              .upsert(
                {
                  user_id: profileId.data,
                  org_id: orgId,
                  role: "user",
                },
                { onConflict: "user_id,org_id" }
              );
          }

          // Handle cohort invitation metadata
          const cohortId = u.public_metadata?.cohortId as string | undefined;
          if (cohortId) {
            const addedBy = u.public_metadata?.addedBy as string | undefined;
            const cohortGroupId = u.public_metadata?.cohortGroupId as string | undefined;
            const corporationId = u.public_metadata?.corporationId as string | undefined;

            const cohortMember: Record<string, unknown> = {
              cohort_id: cohortId,
              user_id: profileId.data,
              status: "active",
              added_at: new Date().toISOString(),
              added_by: addedBy ?? null,
            };

            if (cohortGroupId) {
              cohortMember.cohort_group = cohortGroupId;
            }

            await supabase.from("cohort_members").insert(cohortMember);

            if (corporationId) {
              await supabase
                .from("corp_memberships")
                .upsert(
                  {
                    user_id: profileId.data,
                    corporation_id: corporationId,
                    role: "member",
                  },
                  { onConflict: "user_id,corporation_id" }
                );
            }
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
