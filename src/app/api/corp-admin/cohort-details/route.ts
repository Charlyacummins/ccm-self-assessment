import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const location = typeof body?.location === "string" ? body.location.trim() : undefined;

  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });
  if (name === undefined && location === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
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

  const updates: Record<string, string | null> = {};
  if (name !== undefined) updates.name = name || null;
  if (location !== undefined) updates.location = location || null;

  const { error } = await supabase
    .from("cohorts")
    .update(updates)
    .eq("id", cohortId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
