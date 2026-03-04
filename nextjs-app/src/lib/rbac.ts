export type Role = "ADMIN" | "MEMBER" | "VIEWER";

export type Permission =
  | "agents:execute"
  | "agents:view"
  | "organizations:manage"
  | "organizations:view"
  | "approvals:review"
  | "settings:manage"
  | "export:download"
  | "feedback:submit"
  | "chat:use";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "agents:execute",
    "agents:view",
    "organizations:manage",
    "organizations:view",
    "approvals:review",
    "settings:manage",
    "export:download",
    "feedback:submit",
    "chat:use",
  ],
  MEMBER: [
    "agents:execute",
    "agents:view",
    "organizations:view",
    "export:download",
    "feedback:submit",
    "chat:use",
  ],
  VIEWER: [
    "agents:view",
    "organizations:view",
    "export:download",
  ],
};

export function canAccess(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requireRole(userRole: Role | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  const hierarchy: Role[] = ["VIEWER", "MEMBER", "ADMIN"];
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole);
}
