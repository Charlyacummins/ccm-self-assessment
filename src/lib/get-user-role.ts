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

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", profile.id)
    .not("role", "is", null);

  if (!memberships || memberships.length === 0) {
    return "user";
  }

  const roles = new Set(memberships.map((membership) => membership.role));

  // Prefer the highest-privilege role if a user belongs to multiple orgs.
  if (roles.has("admin")) return "admin";
  if (roles.has("corp_admin")) return "corp_admin";
  if (roles.has("reviewer")) return "reviewer";
  return "user";
});
