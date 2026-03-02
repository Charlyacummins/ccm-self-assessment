import crypto from "crypto";
import { db } from "@/lib/db";

type SendCohortCreatedWebhookParams = {
  cohortId: string;
  adminProfileId: string;
  source: "provision-admin" | "create-cohort" | "ui";
};

function signPayload(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function sendCohortCreatedWebhook({
  cohortId,
  adminProfileId,
  source,
}: SendCohortCreatedWebhookParams): Promise<void> {
  const webhookUrl = process.env.OUTBOUND_COHORT_WEBHOOK_URL;
  const webhookSecret = process.env.OUTBOUND_COHORT_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    return;
  }

  const supabase = db();

  // Prefer corp_memberships for corp admin integration mapping, then fall back to profiles.external_id.
  const { data: corpMembership, error: corpMembershipError } = await supabase
    .from("corp_memberships")
    .select("external_id")
    .eq("user_id", adminProfileId)
    .eq("role", "corp_admin")
    .not("external_id", "is", null)
    .maybeSingle();

  if (corpMembershipError) {
    console.error("cohort.created outbound lookup failed (corp_memberships)", {
      cohortId,
      adminProfileId,
      source,
      error: corpMembershipError.message,
    });
    return;
  }

  let adminExternalId = corpMembership?.external_id ?? null;

  if (!adminExternalId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("external_id")
      .eq("id", adminProfileId)
      .maybeSingle();

    if (profileError) {
      console.error("cohort.created outbound lookup failed (profiles)", {
        cohortId,
        adminProfileId,
        source,
        error: profileError.message,
      });
      return;
    }

    adminExternalId = profile?.external_id ?? null;
  }

  if (!adminExternalId) {
    console.warn("Skipping cohort.created outbound webhook: missing admin_external_id", {
      cohortId,
      adminProfileId,
      source,
      reason: "missing_admin_external_id",
    });
    return;
  }

  const body = JSON.stringify({
    event_type: "cohort.created",
    cohort_id: cohortId,
    admin_external_id: adminExternalId,
    occurred_at: new Date().toISOString(),
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": signPayload(body, webhookSecret),
      },
      body,
    });

    if (!res.ok) {
      const responseText = await res.text().catch(() => "");
      console.error("cohort.created outbound webhook failed", {
        cohortId,
        adminProfileId,
        source,
        status: res.status,
        responseText,
      });
    }
  } catch (error) {
    console.error("cohort.created outbound webhook request error", {
      cohortId,
      adminProfileId,
      source,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
