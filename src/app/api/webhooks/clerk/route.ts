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
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
