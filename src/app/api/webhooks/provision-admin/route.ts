import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import crypto from "crypto";

interface AdminProvisionPayload {
  org_slug: string; // 'ncma' or 'worldcc'
  corporation_name: string;
  admin_user: {
    email: string;
    full_name: string;
    external_id: string; // ID from WorldCC/NCMA system
  };
}

function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.PROVISION_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.PROVISION_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
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

  const { org_slug, corporation_name, admin_user } = data;

  if (!org_slug || !corporation_name || !admin_user?.email) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = db();
  const clerk = await clerkClient();

  try {
    // 1. Create corporation in Supabase
    const { data: corporation, error: corpError } = await supabase
      .from("corporations")
      .insert({
        name: corporation_name,
        org_slug: org_slug,
        external_id: admin_user.external_id,
      })
      .select()
      .single();

    if (corpError) {
      throw new Error(`Failed to create corporation: ${corpError.message}`);
    }

    // 2. Get the parent org from Clerk
    const orgsResponse = await clerk.organizations.getOrganizationList();
    const parentOrg = orgsResponse.data.find((org) => org.slug === org_slug);

    if (!parentOrg) {
      return NextResponse.json(
        { ok: false, error: `Organization ${org_slug} not found` },
        { status: 404 }
      );
    }

    // 3. Check if user exists in Clerk
    const usersResponse = await clerk.users.getUserList({
      emailAddress: [admin_user.email],
    });

    let clerkUserId: string;

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
    }

    // 4. Add user to Clerk organization with corp_admin role
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

    // 5. Update user metadata with corporation ID
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        external_id: admin_user.external_id,
        corporation_id: corporation.id,
        role: "corp:admin",
      },
    });

    // 6. Wait briefly for Clerk webhook to create profile, then get it
    // The Clerk user.created webhook will call upsert_profile RPC
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select()
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (profileError) {
      throw new Error(`Profile not found after user creation: ${profileError.message}`);
    }

    // 7. Create corp_membership linking profile to corporation
    const { error: membershipError } = await supabase
      .from("corp_memberships")
      .insert({
        user_id: profile.id,
        corporation_id: corporation.id,
        role: "corp_admin",
      });

    if (membershipError) {
      throw new Error(`Failed to create corp membership: ${membershipError.message}`);
    }

    // 8. Log the sync
    await supabase.from("org_sync_log").insert({
      sync_type: "admin_provisioned",
      payload: data,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      corporationId: corporation.id,
      clerkUserId,
      profileId: profile.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Provisioning error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
