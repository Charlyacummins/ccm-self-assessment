import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
export default function Dashboard() {
  return (
    <>
      <SignedIn><h1 className="p-6 text-2xl">Dashboard</h1></SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}