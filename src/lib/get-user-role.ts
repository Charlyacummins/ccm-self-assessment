import { cache } from "react";
import { db } from "@/lib/db";
import type { UserRole } from "@/lib/roles";

export const getUserRole = cache(async (clerkUserId: string): Promise<UserRole> => {
  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (!profile) {
    return "user";
  }

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", profile.id)
    .limit(1)
    .single();

  if (!membership) {
    return "user";
  }

  switch (membership.role) {
    case "admin":      return "admin";
    case "corp_admin": return "corp_admin";
    case "reviewer":   return "reviewer";
    default:           return "user";
  }
});
