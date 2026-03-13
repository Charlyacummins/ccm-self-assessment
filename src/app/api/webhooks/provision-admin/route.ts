import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import crypto from "crypto";

interface AdminProvisionPayload {
  org_slug: string; // 'ncma' or 'worldcc'
  corporation_name: string;
  corporation_external_id: string; // Corporation ID from WorldCC/NCMA system
  cohort_external_id?: string; // Optional upstream cohort ID from WorldCC/NCMA system
  admin_user: {
    email: string;
    full_name: string;
    external_id: string; // Admin user ID from WorldCC/NCMA system
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendProvisionedAdminEmail(params: {
  email: string;
  fullName: string;
  corporationName: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://ccm-self-assessment-staging.vercel.app";
  const loginUrl = `${appUrl.replace(/\/$/, "")}/login`;
  const safeName = escapeHtml(params.fullName || "there");
  const safeCorp = escapeHtml(params.corporationName);

  const html = `
    <p>Hi ${safeName},</p>
    <p>Your admin access for <strong>${safeCorp}</strong> has been provisioned.</p>
    <p>Please sign in with this email address to access your dashboard:</p>
    <p><a href="${loginUrl}">${loginUrl}</a></p>
    <p>If you did not expect this, please contact support.</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: params.email,
      subject: "Your CCM admin access is ready",
      html,
    }),
  });

  if (!res.ok) {
    console.error("[provision-admin] Resend error", await res.text());
  }
}

function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.PROVISION_WEBHOOK_SECRET) {
    return false;
  }

  // Reject malformed signatures before timingSafeEqual (it throws on length mismatch).
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.PROVISION_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    const receivedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    return (
      receivedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("x-webhook-signature");

  if (!verifyWebhookSignature(payload, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let data: AdminProvisionPayload;
  try {
    data = JSON.parse(payload);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { org_slug, corporation_name, corporation_external_id, cohort_external_id, admin_user } = data;

  if (!org_slug || !corporation_name || !corporation_external_id || !admin_user?.email) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = db();
  const clerk = await clerkClient();
  const defaultCohortName = `${corporation_name} ${new Date().getFullYear()}`;

  try {
    // 1. Look up organization in Supabase by slug
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", org_slug)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { ok: false, error: `Organization with slug '${org_slug}' not found in database` },
        { status: 404 }
      );
    }

    // 2. Reuse existing corporation by external_id when present (idempotent retries),
    // otherwise create it.
    let corporation: { id: string; org_id: string; external_id: string | null };
    const { data: existingCorporation, error: existingCorpError } = await supabase
      .from("corporations")
      .select("id, org_id, external_id")
      .eq("external_id", corporation_external_id)
      .maybeSingle();

    if (existingCorpError) {
      throw new Error(`Failed to look up corporation: ${existingCorpError.message}`);
    }

    if (existingCorporation) {
      corporation = existingCorporation;
    } else {
      const { data: createdCorporation, error: corpError } = await supabase
        .from("corporations")
        .insert({
          name: corporation_name,
          org_id: org.id,
          external_id: corporation_external_id,
        })
        .select("id, org_id, external_id")
        .single();

      if (corpError || !createdCorporation) {
        throw new Error(`Failed to create corporation: ${corpError?.message ?? "unknown"}`);
      }

      corporation = createdCorporation;
    }

    // 4. Get the parent org from Clerk
    const orgsResponse = await clerk.organizations.getOrganizationList();
    const parentOrg = orgsResponse.data.find((o) => o.slug === org_slug);

    if (!parentOrg) {
      return NextResponse.json(
        { ok: false, error: `Clerk organization ${org_slug} not found` },
        { status: 404 }
      );
    }

    // 5. Check if user exists in Clerk
    const usersResponse = await clerk.users.getUserList({
      emailAddress: [admin_user.email],
    });

    let clerkUserId: string;
    let createdNewClerkUser = false;

    if (usersResponse.data.length > 0) {
      clerkUserId = usersResponse.data[0].id;
    } else {
      // Create new user in Clerk
      const [firstName, ...lastNameParts] = admin_user.full_name.split(" ");
      const user = await clerk.users.createUser({
        emailAddress: [admin_user.email],
        firstName: firstName || admin_user.full_name,
        lastName: lastNameParts.join(" ") || "",
        publicMetadata: {
          external_id: admin_user.external_id,
          corporation_id: corporation.id,
          role: "corp:admin",
        },
        skipPasswordRequirement: true,
        skipPasswordChecks: true,
      });

      clerkUserId = user.id;
      createdNewClerkUser = true;
    }

    // 6. Add user to Clerk organization with corp_admin role
    const membershipsResponse =
      await clerk.organizations.getOrganizationMembershipList({
        organizationId: parentOrg.id,
      });

    const existingMembership = membershipsResponse.data.find(
      (m) => m.publicUserData?.userId === clerkUserId
    );

    if (!existingMembership) {
      await clerk.organizations.createOrganizationMembership({
        organizationId: parentOrg.id,
        userId: clerkUserId,
        role: "org:corp_admin",
      });
    } else {
      await clerk.organizations.updateOrganizationMembership({
        organizationId: parentOrg.id,
        userId: clerkUserId,
        role: "org:corp_admin",
      });
    }

    // 7. Update user metadata with corporation ID
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        external_id: admin_user.external_id,
        corporation_id: corporation.id,
        role: "corp:admin",
      },
    });

    // 8. Upsert profile directly (same as Clerk webhook does)
    const { data: profileId, error: upsertError } = await supabase.rpc("upsert_profile", {
      p_clerk_user_id: clerkUserId,
      p_full_name: admin_user.full_name,
      p_email: admin_user.email,
    });

    if (upsertError || !profileId) {
      throw new Error(`Failed to upsert profile: ${upsertError?.message ?? "no profile id returned"}`);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select()
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      throw new Error(`Profile not found after upsert: ${profileError?.message ?? "unknown"}`);
    }

    // Persist the upstream user identifier on the profile so SSO-linked users
    // can be resolved before their first sign-in.
    if (profile.external_id && profile.external_id !== admin_user.external_id) {
      return NextResponse.json(
        {
          ok: false,
          error: `Profile external_id mismatch for user ${profile.id}`,
        },
        { status: 409 }
      );
    }

    if (!profile.external_id) {
      const { error: profileExternalIdError } = await supabase
        .from("profiles")
        .update({ external_id: admin_user.external_id })
        .eq("id", profile.id);

      if (profileExternalIdError) {
        throw new Error(`Failed to set profile external_id: ${profileExternalIdError.message}`);
      }
    }

    // 9. Upsert corp_membership linking profile to corporation (idempotent retries)
    const { error: membershipError } = await supabase
      .from("corp_memberships")
      .upsert(
        {
          user_id: profile.id,
          corporation_id: corporation.id,
          role: "corp_admin",
          external_id: admin_user.external_id,
        },
        { onConflict: "user_id,corporation_id" }
      );

    if (membershipError) {
      throw new Error(`Failed to create corp membership: ${membershipError.message}`);
    }

    // 10. Add admin to org_memberships
    const { error: orgMembershipError } = await supabase
      .from("org_memberships")
      .upsert(
        {
          user_id: profile.id,
          org_id: org.id,
          role: "corp_admin",
        },
        { onConflict: "user_id,org_id" }
      );

    if (orgMembershipError) {
      throw new Error(`Failed to create org membership: ${orgMembershipError.message}`);
    }

    // 12. Reuse existing cohort when cohort_external_id is provided (idempotent retries).
    let cohort: {
      id: string;
      external_id: string | null;
      company_id: string;
      admin_id: string;
    };

    if (cohort_external_id) {
      const { data: existingCohort, error: existingCohortError } = await supabase
        .from("cohorts")
        .select("id, external_id, company_id, admin_id")
        .eq("external_id", cohort_external_id)
        .maybeSingle();

      if (existingCohortError) {
        throw new Error(`Failed to look up cohort: ${existingCohortError.message}`);
      }

      if (existingCohort) {
        if (existingCohort.company_id !== corporation.id || existingCohort.admin_id !== profile.id) {
          return NextResponse.json(
            { ok: false, error: `cohort_external_id '${cohort_external_id}' is already linked to a different cohort` },
            { status: 409 }
          );
        }
        cohort = existingCohort;
      } else {
        const { data: createdCohort, error: cohortError } = await supabase
          .from("cohorts")
          .insert({
            company_id: corporation.id,
            admin_id: profile.id,
            created_by: profile.id,
            name: defaultCohortName,
            external_id: cohort_external_id,
            template_id: "c9bd8551-b8f4-4255-b2b7-c1b86f18907d",
            status: "draft",
          })
          .select("id, external_id, company_id, admin_id")
          .single();

        if (cohortError || !createdCohort) {
          throw new Error(`Failed to create cohort: ${cohortError?.message ?? "unknown"}`);
        }

        cohort = createdCohort;
      }
    } else {
      const { data: createdCohort, error: cohortError } = await supabase
        .from("cohorts")
        .insert({
          company_id: corporation.id,
          admin_id: profile.id,
          created_by: profile.id,
          name: defaultCohortName,
          template_id: "c9bd8551-b8f4-4255-b2b7-c1b86f18907d",
          status: "draft",
        })
        .select("id, external_id, company_id, admin_id")
        .single();

      if (cohortError || !createdCohort) {
        throw new Error(`Failed to create cohort: ${cohortError?.message ?? "unknown"}`);
      }

      cohort = createdCohort;
    }

    // 13. Log the sync
    await supabase.from("org_sync_log").insert({
      sync_type: "admin_provisioned",
      payload: data,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    // Send a first-login email only when a new Clerk user is created.
    if (createdNewClerkUser) {
      await sendProvisionedAdminEmail({
        email: admin_user.email,
        fullName: admin_user.full_name,
        corporationName: corporation_name,
      });
    }

    return NextResponse.json({
      ok: true,
      corporationId: corporation.id,
      cohortId: cohort.id,
      cohortExternalId: cohort.external_id ?? null,
      clerkUserId,
      profileId: profile.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Provisioning error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
