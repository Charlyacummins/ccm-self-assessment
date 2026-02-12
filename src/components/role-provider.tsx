"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/roles";

const RoleContext = createContext<UserRole | null>(null);

export function RoleProvider({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider value={role}>
      {children}
    </RoleContext.Provider>
  );
}

export function useUserRole(): UserRole {
  const role = useContext(RoleContext);
  if (!role) {
    throw new Error("useUserRole must be used within <RoleProvider>");
  }
  return role;
}
