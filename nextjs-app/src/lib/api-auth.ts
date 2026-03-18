import { auth } from "@/lib/auth";
import { Role, requireRole as checkRole } from "@/lib/rbac";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  organizationId: string | null;
}

/**
 * Validates the NextAuth session from the current request.
 * Returns the authenticated user or throws a Response with 401.
 *
 * Usage in API route handlers:
 *   const user = await requireAuth();
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user) {
    throw new Response(
      JSON.stringify({ error: "Authentication required" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const user = session.user as {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    organizationId?: string | null;
  };

  if (!user.id || !user.email) {
    throw new Response(
      JSON.stringify({ error: "Invalid session: missing user data" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: (user.role as Role) || "ANALYST",
    organizationId: user.organizationId ?? null,
  };
}

/**
 * Validates the session and checks that the user has at least the given role.
 * Returns the authenticated user or throws 401 (no session) / 403 (insufficient role).
 *
 * Usage:
 *   const user = await requireRole("ADMIN");
 */
export async function requireRole(role: Role): Promise<AuthUser> {
  const user = await requireAuth();

  if (!checkRole(user.role, role)) {
    throw new Response(
      JSON.stringify({
        error: "Forbidden: insufficient permissions",
        required: role,
        current: user.role,
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return user;
}
