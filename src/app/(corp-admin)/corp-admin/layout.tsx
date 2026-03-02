import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
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

  const role = await getUserRole(userId);

  if (role !== "corp_admin") {
    if (role === "reviewer") redirect("/reviewer/dashboard");
    if (role === "admin") redirect("/admin/dashboard");
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  const selectedCohortId = cookieStore.get(CORP_ADMIN_SELECTED_COHORT_COOKIE)?.value ?? null;
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

  return (
    <RoleProvider role={role}>
      <div className="flex min-h-screen flex-col">
        <CorpAdminHeader />
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
