import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCorpTemplateOptions } from "@/lib/get-corp-template-options";
import { AdminResultsContent } from "@/components/corp-admin/admin-results-content";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";

export default async function CorpAdminResultsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const templateOptions = await getCorpTemplateOptions();
  const selectedCohortId = cookieStore.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  let percentageBasedScoring = true;
  let initialBenchmarkFilters: Record<string, string> | undefined;

  if (profile) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("percentage_based_scoring, benchmark_default, country_id")
      .eq("user_id", profile.id)
      .maybeSingle();

    percentageBasedScoring = settings?.percentage_based_scoring ?? true;

    if (settings?.benchmark_default === "country" && settings?.country_id) {
      const { data: country } = await supabase
        .from("countries")
        .select("country_name")
        .eq("country_id", settings.country_id)
        .maybeSingle();
      if (country?.country_name) {
        initialBenchmarkFilters = { country: country.country_name };
      }
    }
  }

  return (
    <AdminResultsContent
      templateOptions={templateOptions}
      initialSelectedCohortId={selectedCohortId}
      percentageBasedScoring={percentageBasedScoring}
      initialBenchmarkFilters={initialBenchmarkFilters}
    />
  );
}
