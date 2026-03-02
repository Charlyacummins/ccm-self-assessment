import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import { getUserRole } from "@/lib/get-user-role";

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) redirect("/login");

  const role = await getUserRole(userId);
  if (role !== "admin") redirect("/dashboard");

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r bg-gray-50">
        <div className="p-4 font-semibold">Admin</div>
        <Sidebar />
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
