import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getUserRoles } from "@/lib/get-user-roles";
import { ACTIVE_ROLE_COOKIE, ROLE_REDIRECT } from "@/lib/active-role-cookie";
import type { UserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, { title: string; description: string }> = {
  corp_admin: {
    title: "Admin Dashboard",
    description: "Manage your cohort, view results, and invite participants.",
  },
  reviewer: {
    title: "Reviewer Dashboard",
    description: "Review assessments submitted by your assigned invitees.",
  },
  user: {
    title: "My Assessment",
    description: "Take or continue your own assessment and view your results.",
  },
  admin: {
    title: "System Admin",
    description: "Access system-wide administration tools.",
  },
};

async function selectRole(formData: FormData) {
  "use server";
  const role = formData.get("role") as string;
  const validRoles: UserRole[] = ["corp_admin", "reviewer", "user", "admin"];
  if (!validRoles.includes(role as UserRole)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ROLE_COOKIE, role, {
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
    httpOnly: true,
    sameSite: "lax",
  });

  redirect(ROLE_REDIRECT[role] ?? "/dashboard");
}

export default async function SelectRolePage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const { allRoles: roles } = await getUserRoles(userId);

  // If only one role, skip the selector — server action will set cookie on first nav
  if (roles.length === 1) {
    redirect(ROLE_REDIRECT[roles[0]!] ?? "/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/ccmi_logo.svg"
            alt="Commerce & Contract Management Institute"
            width={220}
            height={44}
            priority
          />
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[#004070]">How would you like to continue?</h1>
            <p className="mt-1 text-sm text-[#534F4F]">
              You have access to multiple areas. Choose a context to continue.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {roles.map((role) => {
            const info = ROLE_LABELS[role] ?? { title: role, description: "" };
            return (
              <form key={role} action={selectRole}>
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-gray-200 bg-white px-6 py-4 text-left shadow-sm transition-all hover:border-[#00ABEB] hover:shadow-md"
                >
                  <p className="font-semibold text-[#004070]">{info.title}</p>
                  <p className="mt-0.5 text-xs text-[#534F4F]">{info.description}</p>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
