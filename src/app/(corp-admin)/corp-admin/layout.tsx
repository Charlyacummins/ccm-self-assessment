import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserRoles } from "@/lib/get-user-roles";
import { ACTIVE_ROLE_COOKIE } from "@/lib/active-role-cookie";
import { RoleProvider } from "@/components/role-provider";
import { CorpAdminHeader } from "@/components/corp-admin/corp-admin-header";
import { Footer } from "@/components/footer";
import { db } from "@/lib/db";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";

export default async function CorpAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  const { primaryRole: role, allRoles: userRoles } = await getUserRoles(userId);

  const cookieStore2 = await cookies();
  const activeRole = cookieStore2.get(ACTIVE_ROLE_COOKIE)?.value;

  // Multi-role: if no cookie set yet, send to role selector
  if (userRoles.length > 1 && !activeRole) {
    redirect("/select-role");
  }

  // If cookie is set to something other than corp_admin, redirect accordingly
  if (activeRole && activeRole !== "corp_admin") {
    if (activeRole === "reviewer") redirect("/reviewer/dashboard");
    if (activeRole === "admin") redirect("/admin/dashboard");
    redirect("/dashboard");
  }

  if (role !== "corp_admin") {
    if (role === "reviewer") redirect("/reviewer/dashboard");
    if (role === "admin") redirect("/admin/dashboard");
    redirect("/dashboard");
  }

  const hasMultipleRoles = userRoles.length > 1;

  const selectedCohortId = cookieStore2.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;
  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const { data: cohorts } = profile
    ? await supabase
        .from("cohorts")
        .select("id, payment_status, created_at")
        .eq("admin_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: [] as Array<{ id: string; payment_status: string | null; created_at: string | null }> };

  const activeCohort =
    (cohorts ?? []).find((cohort) => cohort.id === selectedCohortId) ?? (cohorts ?? [])[0] ?? null;
  const isPaymentBlocked = !!activeCohort && activeCohort.payment_status !== "paid";
  const { data: cohortSettings } = activeCohort
    ? await supabase
        .from("cohort_settings")
        .select("reviewers_enabled, grouping_enabled")
        .eq("cohort_id", activeCohort.id)
        .maybeSingle()
    : { data: null as { reviewers_enabled: boolean; grouping_enabled: boolean } | null };
  const reviewersEnabled = cohortSettings?.reviewers_enabled ?? false;
  const groupingEnabled = cohortSettings?.grouping_enabled ?? false;

  return (
    <RoleProvider role={role}>
      <div className="flex min-h-screen flex-col">
        <CorpAdminHeader reviewersEnabled={reviewersEnabled} groupingEnabled={groupingEnabled} hasMultipleRoles={hasMultipleRoles} />
        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-6 py-8">
          {isPaymentBlocked ? (
            <div className="rounded-lg border border-[#004070]/20 bg-[#004070]/5 p-6">
              <h2 className="text-lg font-semibold text-[#004070]">Features Blocked</h2>
              <p className="mt-2 text-sm text-[#534F4F]">
                These features are blocked until cohort payment has been confirmed.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
        <Footer />
      </div>
    </RoleProvider>
  );
}
