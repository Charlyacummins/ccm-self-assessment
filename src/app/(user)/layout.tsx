import { SignedIn, SignedOut, RedirectToSignIn, UserButton } from "@clerk/nextjs";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>
        <header className="border-b p-4 flex items-center justify-between">
          <div className="font-medium">CCM Self-Assessment</div>
          <UserButton />
        </header>
        <main className="p-6">{children}</main>
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn  />
      </SignedOut>
    </>
  );
}
