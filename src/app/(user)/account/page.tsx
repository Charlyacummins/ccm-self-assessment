import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AccountSettingsCard } from "@/components/account/account-settings-card";
import { SignInMethodsCard } from "@/components/account/sign-in-methods-card";
import {
  AccountManagementForm,
  type AccountManagementData,
} from "@/components/account/account-management-form";
import { type AccountSettingsData } from "@/components/account/account-settings-card";

export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) {
    redirect("/dashboard");
  }

  const { data: dimensions } = await supabase
    .from("user_dimensions")
    .select(
      "country, sub_region, job_role, industry, years_experience, education_level, functional_area, seniority_level"
    )
    .eq("user_id", profile.id)
    .maybeSingle();

  const initialData: AccountManagementData = {
    fullName: profile.full_name ?? "",
    country: dimensions?.country ?? "",
    subRegion: dimensions?.sub_region ?? "",
    jobRole: dimensions?.job_role ?? "",
    industry: dimensions?.industry ?? "",
    yearsExperience:
      dimensions?.years_experience != null
        ? String(dimensions.years_experience)
        : "",
    educationLevel: dimensions?.education_level ?? "",
    functionalArea: dimensions?.functional_area ?? "",
    seniorityLevel: dimensions?.seniority_level ?? "",
  };

  const { data: settings } = await supabase
    .from("user_settings")
    .select(
      "summary_report_mode, dashboard_option, percentage_based_scoring, benchmark_default"
    )
    .eq("user_id", profile.id)
    .maybeSingle();

  const initialSettings: AccountSettingsData = {
    summaryReportMode: settings?.summary_report_mode ?? "summary_reports",
    dashboardOption: settings?.dashboard_option ?? "insights",
    percentageBasedScoring: settings?.percentage_based_scoring ?? true,
    benchmarkDefault: settings?.benchmark_default ?? "global",
  };

  return (
    <div className="space-y-6">
      <AccountManagementForm initialData={initialData} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <AccountSettingsCard initialData={initialSettings} />
        <SignInMethodsCard />
      </div>
    </div>
  );
}
