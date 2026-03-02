import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type CohortQuestionSetData = {
  templateTitle: string | null;
  questions: Array<{
    id: string;
    name: string;
    description: string;
    skillGroupId: string | null;
    skillGroupName: string | null;
    orderIndex: number | null;
  }>;
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, template_id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();

  if (!cohort) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!cohort.template_id) {
    return NextResponse.json({ templateTitle: null, questions: [] satisfies CohortQuestionSetData["questions"] });
  }

  const [templateResult, skillsResult] = await Promise.all([
    supabase
      .from("assessment_templates")
      .select("title")
      .eq("id", cohort.template_id)
      .maybeSingle(),
    supabase
      .from("template_skills")
      .select("id, name, meta_json, skill_group_id, order_index")
      .contains("meta_json", { template_ids: [cohort.template_id] })
      .order("order_index"),
  ]);

  const skillGroupIds = [
    ...new Set(
      (skillsResult.data ?? [])
        .map((skill) => skill.skill_group_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const skillGroupsResult = skillGroupIds.length
    ? await supabase
        .from("template_skill_groups")
        .select("id, name")
        .in("id", skillGroupIds)
    : { data: [] as Array<{ id: string; name: string }>, error: null };

  const skillGroupNameById = Object.fromEntries(
    (skillGroupsResult.data ?? []).map((g) => [g.id, g.name])
  );

  const questions: CohortQuestionSetData["questions"] = (skillsResult.data ?? []).map((skill) => {
    const meta =
      typeof skill.meta_json === "string"
        ? JSON.parse(skill.meta_json)
        : (skill.meta_json ?? {});

    return {
      id: skill.id,
      name: skill.name,
      description: typeof meta?.description === "string" ? meta.description : "",
      skillGroupId: skill.skill_group_id ?? null,
      skillGroupName: skill.skill_group_id ? (skillGroupNameById[skill.skill_group_id] ?? null) : null,
      orderIndex: skill.order_index ?? null,
    };
  });

  return NextResponse.json({
    templateTitle: templateResult.data?.title ?? null,
    questions,
  } satisfies CohortQuestionSetData);
}
