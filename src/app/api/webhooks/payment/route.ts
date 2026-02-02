import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

interface PaymentPayload {
  admin_external_id: string;
  cohort_external_id: string;
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

  let data: PaymentPayload;
  try {
    data = JSON.parse(payload);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { admin_external_id, cohort_external_id } = data;

  if (!admin_external_id || !cohort_external_id) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: admin_external_id, cohort_external_id" },
      { status: 400 }
    );
  }

  const supabase = db();

  try {
    // 1. Log the webhook
    const { data: logEntry } = await supabase
      .from("org_sync_log")
      .insert({
        sync_type: "payment_received",
        payload: data,
      })
      .select()
      .single();

    // 2. Look up admin from external_id
    const { data: adminMembership, error: adminError } = await supabase
      .from("corp_memberships")
      .select("user_id, corporation_id")
      .eq("external_id", admin_external_id)
      .single();

    if (adminError || !adminMembership) {
      throw new Error(`Admin not found with external_id: ${admin_external_id}`);
    }

    // 3. Find cohort by external_id
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .select("id, admin_id, corporation_id")
      .eq("external_id", cohort_external_id)
      .single();

    if (cohortError || !cohort) {
      throw new Error(`Cohort not found with external_id: ${cohort_external_id}`);
    }

    // 4. Verify admin matches cohort
    if (cohort.admin_id !== adminMembership.user_id) {
      return NextResponse.json(
        { ok: false, error: "Admin does not match cohort admin_id" },
        { status: 403 }
      );
    }

    // 5. Update payment status
    const { error: updateError } = await supabase
      .from("cohorts")
      .update({
        payment_status: "paid",
        payment_received_at: new Date().toISOString(),
      })
      .eq("id", cohort.id);

    if (updateError) {
      throw new Error(`Failed to update cohort: ${updateError.message}`);
    }

    // 6. Get org_id for logging
    const { data: corp } = await supabase
      .from("corporations")
      .select("org_id")
      .eq("id", cohort.corporation_id)
      .single();

    // 7. Update log entry
    if (logEntry) {
      await supabase
        .from("org_sync_log")
        .update({
          org_id: corp?.org_id,
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id);
    }

    return NextResponse.json({
      ok: true,
      cohortId: cohort.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Payment webhook error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
