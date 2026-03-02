import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";

type MetaJson = {
  description?: string;
  template_ids?: string[];
  [key: string]: unknown;
};

export type CohortRemovedQuestionsData = {
  questions: Array<{
    id: string;
    name: string;
    description: string;
  }>;
};

function parseMetaJson(value: unknown): MetaJson {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as MetaJson;
    } catch {
      return {};
    }
  }
  return value as MetaJson;
}

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

  const templateId = cohort.template_id;
  if (!templateId) {
    return NextResponse.json({ questions: [] } satisfies CohortRemovedQuestionsData);
  }

  const { data: defaultSkills, error } = await supabase
    .from("template_skills")
    .select("id, name, meta_json")
    .contains("meta_json", { template_ids: [DEFAULT_TEMPLATE_ID] })
    .order("order_index");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const questions: CohortRemovedQuestionsData["questions"] = (defaultSkills ?? [])
    .filter((skill) => {
      const meta = parseMetaJson(skill.meta_json);
      const templateIds = Array.isArray(meta.template_ids)
        ? meta.template_ids.filter((value): value is string => typeof value === "string" && value.length > 0)
        : [];

      return !templateIds.includes(templateId);
    })
    .map((skill) => {
      const meta = parseMetaJson(skill.meta_json);
      return {
        id: skill.id,
        name: skill.name,
        description: typeof meta.description === "string" ? meta.description : "",
      };
    });

  return NextResponse.json({ questions } satisfies CohortRemovedQuestionsData);
}
