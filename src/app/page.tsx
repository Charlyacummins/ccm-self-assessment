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
      redirect("/dashboard");
    case "corp_admin":
      redirect("/dashboard");
    case "reviewer":
      redirect("/dashboard");
    default:
      redirect("/dashboard");
  }
}
