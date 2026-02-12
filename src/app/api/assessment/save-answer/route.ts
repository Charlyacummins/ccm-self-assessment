import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId, templateSkillId, points, openEndedResponse } =
    await req.json();

  const supabase = db();

  // assessment_skill_scores has composite PK (assessment_id, template_skill_id)
  const { data: existing } = await supabase
    .from("assessment_skill_scores")
    .select("assessment_id")
    .eq("assessment_id", assessmentId)
    .eq("template_skill_id", templateSkillId)
    .maybeSingle();

  let error;

  if (existing) {
    ({ error } = await supabase
      .from("assessment_skill_scores")
      .update({
        points,
        final_score: points,
        open_ended_response: openEndedResponse || null,
      })
      .eq("assessment_id", assessmentId)
      .eq("template_skill_id", templateSkillId));
  } else {
    ({ error } = await supabase.from("assessment_skill_scores").insert({
      assessment_id: assessmentId,
      template_skill_id: templateSkillId,
      points,
      final_score: points,
      open_ended_response: openEndedResponse || null,
    }));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
