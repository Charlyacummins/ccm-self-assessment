import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  const role = await getUserRole(userId);

  // Route based on role — expand as admin/reviewer dashboards are built
  switch (role) {
    case "admin":
      redirect("/admin/dashboard");
    case "corp_admin":
      redirect("/corp-admin/dashboard");
    case "reviewer":
      redirect("/reviewer/dashboard");
    default:
      redirect("/dashboard");
  }
}
