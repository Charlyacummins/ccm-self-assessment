import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCorpTemplateOptions } from "@/lib/get-corp-template-options";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";
import { ReviewersContent } from "@/components/corp-admin/reviewers-content";

export default async function ReviewersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const templateOptions = await getCorpTemplateOptions();
  const cookieStore = await cookies();
  const selectedCohortIdFromCookie =
    cookieStore.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;
  const selectedCohortId =
    selectedCohortIdFromCookie &&
    templateOptions.some((option) => option.value === selectedCohortIdFromCookie)
      ? selectedCohortIdFromCookie
      : (templateOptions[0]?.value ?? null);

  if (!selectedCohortId) redirect("/corp-admin/users");

  const supabase = db();
  const { data: settings } = await supabase
    .from("cohort_settings")
    .select("reviewers_enabled")
    .eq("cohort_id", selectedCohortId)
    .maybeSingle();

  if (!settings?.reviewers_enabled) {
    redirect("/corp-admin/users");
  }

  return <ReviewersContent templateOptions={templateOptions} />;
}
