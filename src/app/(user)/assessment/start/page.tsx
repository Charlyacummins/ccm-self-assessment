import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AssessmentFlow } from "@/components/assessment/assessment-flow";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";

interface SkillGroup {
  id: string;
  name: string;
}

interface Question {
  id: string;
  name: string;
  description: string;
  skill_group_id: string;
  display_order: number;
  options: {
    id: string;
    response_text: string;
    point_value: number;
    display_order: number;
  }[];
}

export default async function AssessmentStartPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) redirect("/assessment");

  // Resolve template_id
  let templateId = DEFAULT_TEMPLATE_ID;
  const { data: cohortMember } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", profile.id)
    .limit(1)
    .single();

  if (cohortMember) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("template_id")
      .eq("id", cohortMember.cohort_id)
      .single();

    if (cohort?.template_id) {
      templateId = cohort.template_id;
    }
  }

  // Fetch skill groups for this template (ordered)
  const { data: skillGroups } = await supabase
    .from("template_skill_groups")
    .select("id, name")
    .eq("template_id", templateId)
    .order("id");

  // Fetch all questions (template_skills) for this template with their response options
  const { data: skills } = await supabase
    .from("template_skills")
    .select("id, name, meta_json, skill_group_id, order_index")
    .contains("meta_json", { template_ids: [templateId] })
    .order("order_index");

  // Fetch response options for all skills
  const skillIds = (skills ?? []).map((s) => s.id);
  const { data: options } = await supabase
    .from("skill_response_options")
    .select("id, template_skill_id, response_text, point_value, display_order")
    .in("template_skill_id", skillIds)
    .order("display_order");

  // Combine questions with their options
  const questions: Question[] = (skills ?? []).map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: (typeof skill.meta_json === "string" ? JSON.parse(skill.meta_json) : skill.meta_json)?.description ?? "",
    skill_group_id: skill.skill_group_id,
    display_order: skill.order_index,
    options: (options ?? [])
      .filter((o) => o.template_skill_id === skill.id)
      .map((o) => ({
        id: o.id,
        response_text: o.response_text,
        point_value: o.point_value,
        display_order: o.display_order,
      })),
  }));

  // Check for existing in-progress assessment
  const { data: existingAssessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("user_id", profile.id)
    .eq("template_id", templateId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Create or resume assessment
  let assessmentId: string;
  if (existingAssessment) {
    assessmentId = existingAssessment.id;
  } else {
    const { data: newAssessment, error } = await supabase
      .from("assessments")
      .insert({
        user_id: profile.id,
        template_id: templateId,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !newAssessment) redirect("/assessment");
    assessmentId = newAssessment.id;
  }

  // Fetch any existing answers for this assessment
  const { data: existingScores } = await supabase
    .from("assessment_skill_scores")
    .select("template_skill_id, points, open_ended_response")
    .eq("assessment_id", assessmentId);

  const savedAnswers: Record<string, { points: number | null; text: string }> = {};
  for (const score of existingScores ?? []) {
    savedAnswers[score.template_skill_id] = {
      points: score.points != null ? Number(score.points) : null,
      text: score.open_ended_response ?? "",
    };
  }

  // Sort skill groups by the earliest question order_index in each group
  const sortedSkillGroups = [...(skillGroups ?? [])].sort((a, b) => {
    const aMin = questions.find((q) => q.skill_group_id === a.id)?.display_order ?? Infinity;
    const bMin = questions.find((q) => q.skill_group_id === b.id)?.display_order ?? Infinity;
    return aMin - bMin;
  });

  return (
    <AssessmentFlow
      assessmentId={assessmentId}
      skillGroups={sortedSkillGroups as SkillGroup[]}
      questions={questions}
      savedAnswers={savedAnswers}
    />
  );
}
