import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db"; // your server-side Supabase client

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
        await supabase.rpc("upsert_profile", {
          p_clerk_user_id: u.id,
          p_full_name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
          p_email: u.email_addresses?.[0]?.email_address ?? null,
        });
        break;
      }
      case "organization.created":
      case "organization.updated": {
        const o = evt.data;
        await supabase.rpc("upsert_org", {
          p_clerk_org_id: o.id,
          p_name: o.name ?? "Org",
        });
        break;
      }
      case "organizationMembership.created":
      case "organizationMembership.updated": {
        const m = evt.data;
        const role =
          (m.public_metadata as any)?.role ??
          (m.role as string) ??
          "employee";
        await supabase.rpc("upsert_org_membership", {
          p_clerk_user_id: m.public_user_data.user_id,
          p_clerk_org_id: m.organization.id,
          p_role: role,
        });
        break;
      }
      case "organizationMembership.deleted": {
        const m = evt.data;
        await supabase.rpc("delete_org_membership", {
          p_clerk_user_id: m.public_user_data.user_id,
          p_clerk_org_id: m.organization.id,
        });
        break;
      }
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
