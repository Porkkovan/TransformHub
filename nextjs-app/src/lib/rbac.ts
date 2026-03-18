/**
 * Role-Based Access Control for TransformHub.
 *
 * Role hierarchy (lowest → highest):
 *   VIEWER (0) — read-only dashboards
 *   ANALYST (1) — run agents, view all data   [default for new users]
 *   ADMIN (2)   — manage org settings, users, context docs
 *   SUPER_ADMIN (3) — platform-wide access across all orgs
 *
 * Legacy MEMBER role maps to ANALYST for backwards-compat.
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export type Role = "VIEWER" | "ANALYST" | "ADMIN" | "SUPER_ADMIN" | "MEMBER";

export type Permission =
  | "agents:execute"
  | "agents:view"
  | "organizations:manage"
  | "organizations:view"
  | "approvals:review"
  | "settings:manage"
  | "export:download"
  | "feedback:submit"
  | "chat:use"
  | "admin:users"
  | "admin:api_keys"
  | "admin:sso"
  | "admin:budgets"
  | "platform:super_admin";

export const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  ANALYST: 1,
  MEMBER: 1,   // legacy alias → same as ANALYST
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  VIEWER: [
    "agents:view",
    "organizations:view",
    "export:download",
  ],
  ANALYST: [
    "agents:execute",
    "agents:view",
    "organizations:view",
    "export:download",
    "feedback:submit",
    "chat:use",
  ],
  MEMBER: [ // legacy alias
    "agents:execute",
    "agents:view",
    "organizations:view",
    "export:download",
    "feedback:submit",
    "chat:use",
  ],
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
    "admin:users",
    "admin:api_keys",
    "admin:sso",
    "admin:budgets",
  ],
  SUPER_ADMIN: [
    "agents:execute",
    "agents:view",
    "organizations:manage",
    "organizations:view",
    "approvals:review",
    "settings:manage",
    "export:download",
    "feedback:submit",
    "chat:use",
    "admin:users",
    "admin:api_keys",
    "admin:sso",
    "admin:budgets",
    "platform:super_admin",
  ],
};

export function canAccess(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasRole(userRole: string | undefined, required: Role): boolean {
  return (ROLE_HIERARCHY[userRole ?? ""] ?? -1) >= (ROLE_HIERARCHY[required] ?? 999);
}

/** @deprecated use hasRole() */
export function requireRole(userRole: string | undefined, requiredRole: Role): boolean {
  return hasRole(userRole, requiredRole);
}

// ─── Server-side auth helpers (API route handlers) ───────────────────────────

/**
 * Retrieves and validates the current session. Throws a 401 Response if not
 * authenticated. Returns the session so callers get the typed value.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

/**
 * Same as requireAuth() but also enforces a minimum role. Throws 403 if
 * the user's role is insufficient.
 */
export async function requireRoleAuth(role: Role) {
  const session = await requireAuth();
  const userRole = (session.user as any).role as string | undefined;
  if (!hasRole(userRole, role)) {
    throw NextResponse.json(
      {
        error: "Forbidden",
        detail: `Role '${role}' required. Your role: '${userRole ?? "none"}'.`,
      },
      { status: 403 }
    );
  }
  return session;
}

/**
 * Ensures the authenticated user belongs to the requested organisation.
 * SUPER_ADMIN bypasses the org check.
 */
export async function requireOrgAccess(
  orgId: string,
  minRole: Role = "ANALYST"
) {
  const session = await requireRoleAuth(minRole);
  const userOrgId = (session.user as any).organizationId as string | null;
  const userRole = (session.user as any).role as string;

  if (userRole === "SUPER_ADMIN") return session;

  if (userOrgId !== orgId) {
    throw NextResponse.json(
      {
        error: "Forbidden",
        detail: "You do not have access to this organisation.",
      },
      { status: 403 }
    );
  }
  return session;
}
