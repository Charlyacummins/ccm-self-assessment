import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId } = await req.json();

  const supabase = db();

  const { error } = await supabase
    .from("assessments")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_year: new Date().getFullYear(),
    })
    .eq("id", assessmentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
