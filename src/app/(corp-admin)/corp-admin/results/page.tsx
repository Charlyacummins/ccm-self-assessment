import { cookies } from "next/headers";
import { getCorpTemplateOptions } from "@/lib/get-corp-template-options";
import { AdminResultsContent } from "@/components/corp-admin/admin-results-content";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";

export default async function CorpAdminResultsPage() {
  const cookieStore = await cookies();
  const templateOptions = await getCorpTemplateOptions();
  const selectedCohortId = cookieStore.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;

  return (
    <AdminResultsContent
      templateOptions={templateOptions}
      initialSelectedCohortId={selectedCohortId}
    />
  );
}
