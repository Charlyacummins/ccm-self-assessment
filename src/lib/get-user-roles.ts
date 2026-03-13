import { cache } from "react";
import { db } from "@/lib/db";
import type { UserRole } from "@/lib/roles";

export interface UserRolesResult {
  /** Highest-privilege primary role (used by RoleProvider and role-specific logic) */
  primaryRole: UserRole;
  /** All contexts available to this user */
  allRoles: UserRole[];
}

/**
 * Single cached DB round-trip that returns both the primary role and all
 * available role contexts. Use this in layouts instead of calling
 * getUserRole + getUserRoles separately.
 */
export const getUserRoles = cache(async (clerkUserId: string): Promise<UserRolesResult> => {
  const supabase = db();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (!profile) return { primaryRole: "user", allRoles: ["user"] };

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", profile.id)
    .not("role", "is", null);

  const roles = new Set<UserRole>();

  for (const m of memberships ?? []) {
    if (
      m.role === "admin" ||
      m.role === "corp_admin" ||
      m.role === "reviewer"
    ) {
      roles.add(m.role as UserRole);
    }
  }

  // Check for secondary participation via also_participant flag
  const { data: participantRows } = await supabase
    .from("cohort_members")
    .select("participant_type")
    .eq("user_id", profile.id)
    .eq("also_participant", true)
    .not("participant_type", "is", null);

  for (const row of participantRows ?? []) {
    if (row.participant_type === "user" || row.participant_type === "reviewer") {
      roles.add(row.participant_type as UserRole);
    }
  }

  // Check if a reviewer also has plain user membership in any cohort
  if (roles.has("reviewer") && !roles.has("user")) {
    const { data: userRows } = await supabase
      .from("cohort_members")
      .select("user_id")
      .eq("user_id", profile.id)
      .eq("role", "user")
      .limit(1);
    if (userRows && userRows.length > 0) {
      roles.add("user");
    }
  }

  const allRoles: UserRole[] = roles.size === 0 ? ["user"] : [...roles];

  // Primary role = highest privilege
  let primaryRole: UserRole = "user";
  if (roles.has("admin")) primaryRole = "admin";
  else if (roles.has("corp_admin")) primaryRole = "corp_admin";
  else if (roles.has("reviewer")) primaryRole = "reviewer";

  return { primaryRole, allRoles };
});
