import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_TEMPLATE_ID = "c9bd8551-b8f4-4255-b2b7-c1b86f18907d";

type MetaJson = {
  description?: string;
  template_ids?: string[];
  [key: string]: unknown;
};

export type CohortCustomQuestionsData = {
  questions: Array<{
    id: string;
    text: string;
    description: string;
    templateSkillId: string | null;
    answerOptions: Array<{
      id: string;
      responseText: string;
      pointValue: number;
      displayOrder: number | null;
    }>;
  }>;
};

type ResponseOptionDraft = {
  responseText: string;
  pointValue: number;
  displayOrder: number;
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

async function resolveAdminForCohort(userId: string, cohortId: string) {
  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) {
    return { error: NextResponse.json({ error: "Profile not found" }, { status: 404 }) };
  }

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, template_id, company_id")
    .eq("id", cohortId)
    .eq("admin_id", profile.id)
    .maybeSingle();

  if (!cohort) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, cohort };
}

async function createDerivedTemplate(
  supabase: ReturnType<typeof db>,
  cohortId: string,
  cohortName: string | null
) {
  const year = new Date().getFullYear();
  const trimmedCohortName = cohortName?.trim();
  const templateTitle = trimmedCohortName ? `${trimmedCohortName} ${year}` : `Custom Assessment ${year}`;
  const { data: newTemplate, error: newTemplateError } = await supabase
    .from("assessment_templates")
    .insert({ title: templateTitle })
    .select("id")
    .single();

  if (newTemplateError || !newTemplate) {
    throw new Error(newTemplateError?.message ?? "Failed to create template");
  }

  const { data: baseSkills, error: baseSkillsError } = await supabase
    .from("template_skills")
    .select("id, meta_json")
    .contains("meta_json", { template_ids: [DEFAULT_TEMPLATE_ID] });

  if (baseSkillsError) {
    throw new Error(baseSkillsError.message);
  }

  await Promise.all(
    (baseSkills ?? []).map(async (skill) => {
      const meta = parseMetaJson(skill.meta_json);
      const templateIds = Array.isArray(meta.template_ids)
        ? meta.template_ids.filter((value): value is string => typeof value === "string" && value.length > 0)
        : [];

      if (templateIds.includes(newTemplate.id)) return;

      const nextMeta = {
        ...meta,
        template_ids: [...templateIds, newTemplate.id],
      };

      const { error } = await supabase
        .from("template_skills")
        .update({ meta_json: nextMeta })
        .eq("id", skill.id);

      if (error) throw new Error(error.message);
    })
  );

  const { error: cohortUpdateError } = await supabase
    .from("cohorts")
    .update({ template_id: newTemplate.id })
    .eq("id", cohortId);

  if (cohortUpdateError) {
    throw new Error(cohortUpdateError.message);
  }

  return newTemplate.id;
}

async function ensureEditableTemplate(
  supabase: ReturnType<typeof db>,
  cohortId: string,
  cohortName: string | null,
  currentTemplateId: string | null
) {
  if (currentTemplateId && currentTemplateId !== DEFAULT_TEMPLATE_ID) {
    return currentTemplateId;
  }
  return createDerivedTemplate(supabase, cohortId, cohortName);
}

async function attemptRevertToDefaultTemplate(
  supabase: ReturnType<typeof db>,
  cohortId: string
) {
  const { data } = await supabase.rpc("rpc_revert_cohort_to_default_template_if_equivalent", {
    p_cohort_id: cohortId,
  });
  const row = (data?.[0] ?? null) as { changed?: boolean; reason?: string } | null;
  return {
    changed: row?.changed === true,
    reason: row?.reason ?? null,
  };
}

async function cleanupDerivedTemplateIfUnused(
  supabase: ReturnType<typeof db>,
  templateId: string | null
) {
  if (!templateId || templateId === DEFAULT_TEMPLATE_ID) {
    return { deleted: false, reason: "template_not_cleanup_candidate" };
  }

  const [{ count: cohortCount }, { count: assessmentCount }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId),
    supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId),
  ]);

  if ((cohortCount ?? 0) > 0) {
    return { deleted: false, reason: "template_still_used_by_cohort" };
  }

  if ((assessmentCount ?? 0) > 0) {
    return { deleted: false, reason: "template_still_used_by_assessment" };
  }

  const { data: skillsWithTemplateId } = await supabase
    .from("template_skills")
    .select("id, meta_json")
    .contains("meta_json", { template_ids: [templateId] });

  for (const skill of skillsWithTemplateId ?? []) {
    const meta = parseMetaJson(skill.meta_json);
    const templateIds = Array.isArray(meta.template_ids)
      ? meta.template_ids.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

    if (!templateIds.includes(templateId)) continue;

    const nextMeta = {
      ...meta,
      template_ids: templateIds.filter((value) => value !== templateId),
    };

    const { error: skillUpdateError } = await supabase
      .from("template_skills")
      .update({ meta_json: nextMeta })
      .eq("id", skill.id);

    if (skillUpdateError) {
      return { deleted: false, reason: `failed_skill_cleanup:${skillUpdateError.message}` };
    }
  }

  const { error: deleteTemplateError } = await supabase
    .from("assessment_templates")
    .delete()
    .eq("id", templateId);

  if (deleteTemplateError) {
    return { deleted: false, reason: `failed_template_delete:${deleteTemplateError.message}` };
  }

  return { deleted: true, reason: "deleted" };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const resolved = await resolveAdminForCohort(userId, cohortId);
  if ("error" in resolved) return resolved.error;
  const { supabase } = resolved;

  const { data: customSkills, error: customSkillsError } = await supabase
    .from("custom_skills")
    .select("id, name, meta_json, template_skill_id")
    .eq("cohort_id", cohortId);

  if (customSkillsError) {
    return NextResponse.json({ error: customSkillsError.message }, { status: 500 });
  }

  const customSkillIds = (customSkills ?? []).map((q) => q.id);

  const { data: responseOptions, error: optionsError } = customSkillIds.length
    ? await supabase
        .from("custom_skill_response_options")
        .select("id, custom_skill_id, response_text, point_value, display_order")
        .in("custom_skill_id", customSkillIds)
        .order("display_order")
    : { data: [], error: null };

  if (optionsError) {
    return NextResponse.json({ error: optionsError.message }, { status: 500 });
  }

  const optionsByCustomSkillId = new Map<
    string,
    CohortCustomQuestionsData["questions"][number]["answerOptions"]
  >();

  for (const row of responseOptions ?? []) {
    const key = row.custom_skill_id;
    if (!key) continue;

    const existing = optionsByCustomSkillId.get(key) ?? [];
    existing.push({
      id: row.id,
      responseText: row.response_text,
      pointValue: Number(row.point_value ?? 0),
      displayOrder: row.display_order ?? null,
    });
    optionsByCustomSkillId.set(key, existing);
  }

  const questions: CohortCustomQuestionsData["questions"] = (customSkills ?? []).map((q) => {
    const meta = parseMetaJson(q.meta_json);
    const description = typeof meta.description === "string" ? meta.description : "";

    return {
      id: q.id,
      text: q.name ?? "Untitled question",
      description,
      templateSkillId: q.template_skill_id ?? null,
      answerOptions: optionsByCustomSkillId.get(q.id) ?? [],
    };
  });

  return NextResponse.json({ questions } satisfies CohortCustomQuestionsData);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const questionText = typeof body?.questionText === "string" ? body.questionText.trim() : "";
  const responseOptionsInput = Array.isArray(body?.responseOptions) ? body.responseOptions : [];

  if (!cohortId || !name || !questionText) {
    return NextResponse.json({ error: "cohortId, name, and questionText are required" }, { status: 400 });
  }

  const responseOptions: ResponseOptionDraft[] = responseOptionsInput
    .map((option: unknown, index: number) => {
      const row = option as { responseText?: unknown; pointValue?: unknown };
      const responseText = typeof row.responseText === "string" ? row.responseText.trim() : "";
      const pointValueNumber = Number(row.pointValue);

      return {
        responseText,
        pointValue: Number.isFinite(pointValueNumber) ? pointValueNumber : 0,
        displayOrder: index,
      };
    })
    .filter((option: ResponseOptionDraft) => option.responseText.length > 0);

  if (responseOptions.length === 0) {
    return NextResponse.json({ error: "At least one response option is required" }, { status: 400 });
  }

  const resolved = await resolveAdminForCohort(userId, cohortId);
  if ("error" in resolved) return resolved.error;
  const { supabase, cohort } = resolved;

  try {
    const newTemplateId = await ensureEditableTemplate(
      supabase,
      cohortId,
      cohort.name ?? null,
      cohort.template_id ?? null
    );

    const { data: customSkill, error: insertError } = await supabase
      .from("custom_skills")
      .insert({
        cohort_id: cohortId,
        company_id: cohort.company_id,
        name,
        meta_json: {
          description: questionText,
          template_id: newTemplateId,
        },
      })
      .select("id")
      .single();

    if (insertError || !customSkill) {
      return NextResponse.json({ error: insertError?.message ?? "Failed to create custom question" }, { status: 500 });
    }

    const optionRows = responseOptions.map((option) => ({
      custom_skill_id: customSkill.id,
      response_text: option.responseText,
      point_value: option.pointValue,
      display_order: option.displayOrder,
    }));

    const { error: optionsInsertError } = await supabase
      .from("custom_skill_response_options")
      .insert(optionRows);

    if (optionsInsertError) {
      return NextResponse.json({ error: optionsInsertError.message }, { status: 500 });
    }

    const revert = await attemptRevertToDefaultTemplate(supabase, cohortId);
    const cleanup =
      revert.changed
        ? await cleanupDerivedTemplateIfUnused(supabase, cohort.template_id ?? null)
        : null;
    return NextResponse.json({
      ok: true,
      templateId: newTemplateId,
      customSkillId: customSkill.id,
      revert,
      cleanup,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create custom question" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const customSkillId = typeof body?.customSkillId === "string" ? body.customSkillId : "";
  const templateSkillId = typeof body?.templateSkillId === "string" ? body.templateSkillId : "";

  if (!cohortId || (!customSkillId && !templateSkillId)) {
    return NextResponse.json(
      { error: "cohortId and one of customSkillId/templateSkillId are required" },
      { status: 400 }
    );
  }

  const resolved = await resolveAdminForCohort(userId, cohortId);
  if ("error" in resolved) return resolved.error;
  const { supabase, cohort } = resolved;

  if (customSkillId) {
    const { data: customSkill, error: customSkillError } = await supabase
      .from("custom_skills")
      .select("id, template_skill_id")
      .eq("id", customSkillId)
      .eq("cohort_id", cohortId)
      .maybeSingle();

    if (customSkillError || !customSkill) {
      return NextResponse.json({ error: customSkillError?.message ?? "Custom question not found" }, { status: 404 });
    }

    const currentTemplateId = cohort.template_id ?? null;
    if (customSkill.template_skill_id && currentTemplateId) {
      const { data: skill } = await supabase
        .from("template_skills")
        .select("id, meta_json")
        .eq("id", customSkill.template_skill_id)
        .maybeSingle();

      if (skill) {
        const meta = parseMetaJson(skill.meta_json);
        const templateIds = Array.isArray(meta.template_ids)
          ? meta.template_ids.filter((value): value is string => typeof value === "string" && value.length > 0)
          : [];
        const nextMeta = {
          ...meta,
          template_ids: templateIds.filter((templateId) => templateId !== currentTemplateId),
        };

        const { error: templateSkillUpdateError } = await supabase
          .from("template_skills")
          .update({ meta_json: nextMeta })
          .eq("id", customSkill.template_skill_id);

        if (templateSkillUpdateError) {
          return NextResponse.json({ error: templateSkillUpdateError.message }, { status: 500 });
        }
      }
    }

    await supabase
      .from("custom_skill_response_options")
      .delete()
      .eq("custom_skill_id", customSkillId);

    const { error: deleteCustomSkillError } = await supabase
      .from("custom_skills")
      .delete()
      .eq("id", customSkillId)
      .eq("cohort_id", cohortId);

    if (deleteCustomSkillError) {
      return NextResponse.json({ error: deleteCustomSkillError.message }, { status: 500 });
    }

    const revert = await attemptRevertToDefaultTemplate(supabase, cohortId);
    const cleanup =
      revert.changed
        ? await cleanupDerivedTemplateIfUnused(supabase, cohort.template_id ?? null)
        : null;
    return NextResponse.json({ ok: true, customSkillId, revert, cleanup });
  }

  try {
    const newTemplateId = await ensureEditableTemplate(
      supabase,
      cohortId,
      cohort.name ?? null,
      cohort.template_id ?? null
    );

    const { data: skill, error: skillError } = await supabase
      .from("template_skills")
      .select("id, meta_json")
      .eq("id", templateSkillId)
      .maybeSingle();

    if (skillError || !skill) {
      return NextResponse.json({ error: skillError?.message ?? "Question not found" }, { status: 404 });
    }

    const meta = parseMetaJson(skill.meta_json);
    const templateIds = Array.isArray(meta.template_ids)
      ? meta.template_ids.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

    const nextMeta = {
      ...meta,
      template_ids: templateIds.filter((templateId) => templateId !== newTemplateId),
    };

    const { error: updateError } = await supabase
      .from("template_skills")
      .update({ meta_json: nextMeta })
      .eq("id", templateSkillId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const revert = await attemptRevertToDefaultTemplate(supabase, cohortId);
    const cleanup =
      revert.changed
        ? await cleanupDerivedTemplateIfUnused(supabase, cohort.template_id ?? null)
        : null;
    return NextResponse.json({ ok: true, templateId: newTemplateId, revert, cleanup });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove question" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const customSkillId = typeof body?.customSkillId === "string" ? body.customSkillId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const questionText = typeof body?.questionText === "string" ? body.questionText.trim() : "";
  const responseOptionsInput = Array.isArray(body?.responseOptions) ? body.responseOptions : [];

  if (!cohortId || !customSkillId || !name || !questionText) {
    return NextResponse.json(
      { error: "cohortId, customSkillId, name, and questionText are required" },
      { status: 400 }
    );
  }

  const responseOptions: ResponseOptionDraft[] = responseOptionsInput
    .map((option: unknown, index: number) => {
      const row = option as { responseText?: unknown; pointValue?: unknown };
      const responseText = typeof row.responseText === "string" ? row.responseText.trim() : "";
      const pointValueNumber = Number(row.pointValue);

      return {
        responseText,
        pointValue: Number.isFinite(pointValueNumber) ? pointValueNumber : 0,
        displayOrder: index,
      };
    })
    .filter((option: ResponseOptionDraft) => option.responseText.length > 0);

  if (responseOptions.length === 0) {
    return NextResponse.json({ error: "At least one response option is required" }, { status: 400 });
  }

  const resolved = await resolveAdminForCohort(userId, cohortId);
  if ("error" in resolved) return resolved.error;
  const { supabase, cohort } = resolved;

  const { data: customSkill, error: customSkillError } = await supabase
    .from("custom_skills")
    .select("id")
    .eq("id", customSkillId)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  if (customSkillError || !customSkill) {
    return NextResponse.json({ error: customSkillError?.message ?? "Custom question not found" }, { status: 404 });
  }

  const { error: updateCustomSkillError } = await supabase
    .from("custom_skills")
    .update({
      name,
      meta_json: {
        description: questionText,
        template_id: cohort.template_id ?? null,
      },
    })
    .eq("id", customSkillId)
    .eq("cohort_id", cohortId);

  if (updateCustomSkillError) {
    return NextResponse.json({ error: updateCustomSkillError.message }, { status: 500 });
  }

  await supabase
    .from("custom_skill_response_options")
    .delete()
    .eq("custom_skill_id", customSkillId);

  const optionRows = responseOptions.map((option) => ({
    custom_skill_id: customSkillId,
    response_text: option.responseText,
    point_value: option.pointValue,
    display_order: option.displayOrder,
  }));

  const { error: optionsInsertError } = await supabase
    .from("custom_skill_response_options")
    .insert(optionRows);

  if (optionsInsertError) {
    return NextResponse.json({ error: optionsInsertError.message }, { status: 500 });
  }

  const revert = await attemptRevertToDefaultTemplate(supabase, cohortId);
  const cleanup =
    revert.changed
      ? await cleanupDerivedTemplateIfUnused(supabase, cohort.template_id ?? null)
      : null;
  return NextResponse.json({ ok: true, customSkillId, revert, cleanup });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId : "";
  const templateSkillId = typeof body?.templateSkillId === "string" ? body.templateSkillId : "";

  if (!cohortId || !templateSkillId) {
    return NextResponse.json({ error: "cohortId and templateSkillId are required" }, { status: 400 });
  }

  const resolved = await resolveAdminForCohort(userId, cohortId);
  if ("error" in resolved) return resolved.error;
  const { supabase, cohort } = resolved;

  try {
    const newTemplateId = await ensureEditableTemplate(
      supabase,
      cohortId,
      cohort.name ?? null,
      cohort.template_id ?? null
    );

    const { data: skill, error: skillError } = await supabase
      .from("template_skills")
      .select("id, meta_json")
      .eq("id", templateSkillId)
      .maybeSingle();

    if (skillError || !skill) {
      return NextResponse.json({ error: skillError?.message ?? "Question not found" }, { status: 404 });
    }

    const meta = parseMetaJson(skill.meta_json);
    const templateIds = Array.isArray(meta.template_ids)
      ? meta.template_ids.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

    const nextMeta = {
      ...meta,
      template_ids: templateIds.includes(newTemplateId)
        ? templateIds
        : [...templateIds, newTemplateId],
    };

    const { error: updateError } = await supabase
      .from("template_skills")
      .update({ meta_json: nextMeta })
      .eq("id", templateSkillId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const revert = await attemptRevertToDefaultTemplate(supabase, cohortId);
    const cleanup =
      revert.changed
        ? await cleanupDerivedTemplateIfUnused(supabase, cohort.template_id ?? null)
        : null;
    return NextResponse.json({ ok: true, templateId: newTemplateId, revert, cleanup });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to restore question" },
      { status: 500 }
    );
  }
}
