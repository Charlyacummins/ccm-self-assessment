import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

interface CreateCohortPayload {
  admin_external_id: string;
  corporation_external_id: string;
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

  let data: CreateCohortPayload;
  try {
    data = JSON.parse(payload);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { admin_external_id, corporation_external_id } = data;

  if (!admin_external_id || !corporation_external_id) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: admin_external_id, corporation_external_id" },
      { status: 400 }
    );
  }

  const supabase = db();

  try {
    // 1. Log the webhook
    const { data: logEntry } = await supabase
      .from("org_sync_log")
      .insert({
        sync_type: "cohort_created",
        payload: data,
      })
      .select()
      .single();

    // 2. Resolve admin membership and ensure this is a corp_admin
    const { data: adminMembership, error: adminError } = await supabase
      .from("corp_memberships")
      .select("user_id, corporation_id, role")
      .eq("external_id", admin_external_id)
      .single();

    if (adminError || !adminMembership) {
      throw new Error(`Admin not found with external_id: ${admin_external_id}`);
    }

    if (adminMembership.role !== "corp_admin") {
      return NextResponse.json(
        { ok: false, error: "User is not a corp_admin" },
        { status: 403 }
      );
    }

    // 3. Resolve corporation by external ID and validate it matches admin membership
    const { data: corporation, error: corpError } = await supabase
      .from("corporations")
      .select("id, org_id, name")
      .eq("external_id", corporation_external_id)
      .single();

    if (corpError || !corporation) {
      return NextResponse.json(
        { ok: false, error: `Corporation not found with external_id: ${corporation_external_id}` },
        { status: 404 }
      );
    }

    if (corporation.id !== adminMembership.corporation_id) {
      return NextResponse.json(
        { ok: false, error: "Admin does not belong to the provided corporation" },
        { status: 403 }
      );
    }

    const defaultCohortName = `${corporation.name} ${new Date().getFullYear()}`;

    // 4. Create a new cohort (this endpoint does not assign cohort_external_id).
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .insert({
        company_id: corporation.id,
        admin_id: adminMembership.user_id,
        created_by: adminMembership.user_id,
        name: defaultCohortName,
        template_id: "c9bd8551-b8f4-4255-b2b7-c1b86f18907d",
      })
      .select("id, external_id, company_id, admin_id")
      .single();

    if (cohortError || !cohort) {
      throw new Error(`Failed to create cohort: ${cohortError?.message ?? "unknown"}`);
    }

    // 5. Update log entry
    if (logEntry) {
      await supabase
        .from("org_sync_log")
        .update({
          org_id: corporation.org_id,
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id);
    }

    return NextResponse.json({
      ok: true,
      cohortId: cohort.id,
      corporationId: corporation.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Create cohort webhook error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
