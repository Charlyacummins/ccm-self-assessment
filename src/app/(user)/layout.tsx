import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserRoles } from "@/lib/get-user-roles";
import { ACTIVE_ROLE_COOKIE } from "@/lib/active-role-cookie";
import { RoleProvider } from "@/components/role-provider";
import { UserHeader } from "@/components/user-header";
import { Footer } from "@/components/footer";

export default async function UserLayout({
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
  if (activeRole && activeRole !== "user") {
    if (activeRole === "corp_admin") redirect("/corp-admin/dashboard");
    if (activeRole === "reviewer") redirect("/reviewer/dashboard");
    if (activeRole === "admin") redirect("/admin/dashboard");
  }

  // Single-role redirects for non-user roles (only when no cookie — cookie takes precedence)
  if (!activeRole) {
    if (role === "admin") redirect("/admin/dashboard");
    if (role === "corp_admin") redirect("/corp-admin/dashboard");
    if (role === "reviewer") redirect("/reviewer/dashboard");
  }

  const hasMultipleRoles = userRoles.length > 1;

  return (
    <RoleProvider role={role}>
      <div className="flex min-h-screen flex-col">
        <UserHeader hasMultipleRoles={hasMultipleRoles} />
        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-6 py-8">
          {children}
        </main>
        <Footer />
      </div>
    </RoleProvider>
  );
}
