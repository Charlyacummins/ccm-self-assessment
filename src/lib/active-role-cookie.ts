export const ACTIVE_ROLE_COOKIE = "active_role";

export const ROLE_REDIRECT: Record<string, string> = {
  corp_admin: "/corp-admin/dashboard",
  reviewer: "/reviewer/dashboard",
  admin: "/admin/dashboard",
  user: "/dashboard",
};

// Higher number = higher privilege
export const ROLE_PRIORITY: Record<string, number> = {
  admin: 4,
  corp_admin: 3,
  reviewer: 2,
  user: 1,
};
