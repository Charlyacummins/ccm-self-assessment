import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { TemplateOption } from "@/components/corp-admin/manage-assessments-content";

export async function getCorpTemplateOptions(): Promise<TemplateOption[]> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) return [];

  const { data: corpMembership } = await supabase
    .from("corp_memberships")
    .select("corporation_id")
    .eq("user_id", profile.id)
    .eq("role", "corp_admin")
    .limit(1)
    .maybeSingle();

  if (!corpMembership) return [];

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id, name, template_id, created_at, company_id")
    .eq("company_id", corpMembership.corporation_id)
    .eq("admin_id", profile.id);

  const validCohorts = (cohorts ?? []).filter(
    (c): c is { id: string; name: string | null; template_id: string; created_at: string; company_id: string } =>
      !!c.template_id
  );

  if (validCohorts.length === 0) return [];

  const templateIds = [...new Set(validCohorts.map((c) => c.template_id))];

  const { data: templates } = await supabase
    .from("assessment_templates")
    .select("id, title")
    .in("id", templateIds);

  const titleById = Object.fromEntries((templates ?? []).map((t) => [t.id, t.title]));

  return validCohorts.map((c) => {
    const title = titleById[c.template_id] ?? "Unknown Template";
    const cohortName = c.name?.trim() || `Cohort ${new Date(c.created_at).getFullYear()}`;
    const label = `${title} - ${cohortName}`;
    return { value: c.id, label, corporationId: c.company_id };
  });
}
