import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CorpAdminNameForm } from "@/components/corp-admin/corp-admin-name-form";
import { CohortDetailsCard } from "@/components/corp-admin/cohort-details-card";
import { AccountSettingsCard, type AccountSettingsData } from "@/components/account/account-settings-card";
import { SignInMethodsCard } from "@/components/account/sign-in-methods-card";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";

export default async function CorpAdminAccountPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();
  const cookieStore = await cookies();
  const selectedCohortId = cookieStore.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) redirect("/corp-admin/dashboard");

  const [{ data: cohorts }, { data: settings }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, location")
      .eq("admin_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_settings")
      .select("summary_report_mode, dashboard_option, percentage_based_scoring, benchmark_default, country_id")
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  const activeCohort =
    (cohorts ?? []).find((c) => c.id === selectedCohortId) ?? (cohorts ?? [])[0] ?? null;

  const initialSettings: AccountSettingsData = {
    summaryReportMode: settings?.summary_report_mode ?? "summary_reports",
    dashboardOption: settings?.dashboard_option ?? "insights",
    percentageBasedScoring: settings?.percentage_based_scoring ?? true,
    benchmarkDefault: settings?.benchmark_default ?? "global",
    countryId: settings?.country_id ?? null,
  };

  return (
    <div className="space-y-6">
      <CorpAdminNameForm initialName={profile.full_name ?? ""} />
      {activeCohort && (
        <CohortDetailsCard
          initialData={{
            cohortId: activeCohort.id,
            name: activeCohort.name ?? "",
            location: activeCohort.location ?? "",
          }}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <AccountSettingsCard initialData={initialSettings} />
        <SignInMethodsCard />
      </div>
    </div>
  );
}
