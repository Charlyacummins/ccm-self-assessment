"use client";

import { useClerk } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SignInMethodsCard() {
  const { openUserProfile } = useClerk();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#004070]">Sign in methods</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-[#004070]">Manage your sign-in methods</p>
          <p className="text-xs text-muted-foreground">
            Open Clerk account settings to update password, sessions, and more.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => openUserProfile()}
          className="mt-6 h-11 rounded-lg bg-[#003B64] px-8 text-white hover:bg-[#002f50]"
        >
          Open Account Modal
        </Button>
      </CardContent>
    </Card>
  );
}
