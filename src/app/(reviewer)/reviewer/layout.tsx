import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserRoles } from "@/lib/get-user-roles";
import { ACTIVE_ROLE_COOKIE } from "@/lib/active-role-cookie";
import { RoleProvider } from "@/components/role-provider";
import { ReviewerHeader } from "@/components/reviewer/reviewer-header";
import { Footer } from "@/components/footer";

export default async function ReviewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  const { primaryRole: role, allRoles: userRoles } = await getUserRoles(userId);

  const cookieStore = await cookies();
  const activeRole = cookieStore.get(ACTIVE_ROLE_COOKIE)?.value;

  // Multi-role: if no cookie set yet, send to role selector
  if (userRoles.length > 1 && !activeRole) {
    redirect("/select-role");
  }

  // If cookie directs elsewhere, respect it
  if (activeRole && activeRole !== "reviewer") {
    if (activeRole === "corp_admin") redirect("/corp-admin/dashboard");
    if (activeRole === "admin") redirect("/admin/dashboard");
    redirect("/dashboard");
  }

  // Single-role: user doesn't have reviewer access at all
  if (!userRoles.includes("reviewer")) {
    redirect("/dashboard");
  }

  const hasMultipleRoles = userRoles.length > 1;

  return (
    <RoleProvider role={role}>
      <div className="flex min-h-screen flex-col">
        <ReviewerHeader hasMultipleRoles={hasMultipleRoles} />
        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-6 py-8">
          {children}
        </main>
        <Footer />
      </div>
    </RoleProvider>
  );
}
