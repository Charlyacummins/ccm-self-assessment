import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
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

  const role = await getUserRole(userId);

  if (role !== "reviewer") {
    redirect("/dashboard");
  }

  return (
    <RoleProvider role={role}>
      <div className="flex min-h-screen flex-col">
        <ReviewerHeader />
        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-6 py-8">
          {children}
        </main>
        <Footer />
      </div>
    </RoleProvider>
  );
}
