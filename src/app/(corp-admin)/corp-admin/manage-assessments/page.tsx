import { cookies } from "next/headers";
import { getCorpTemplateOptions } from "@/lib/get-corp-template-options";
import { ManageAssessmentsContent } from "@/components/corp-admin/manage-assessments-content";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";

export default async function ManageAssessmentsPage() {
  const cookieStore = await cookies();
  const templateOptions = await getCorpTemplateOptions();
  const selectedCohortId = cookieStore.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;

  return (
    <ManageAssessmentsContent
      templateOptions={templateOptions}
      initialSelectedCohortId={selectedCohortId}
    />
  );
}
