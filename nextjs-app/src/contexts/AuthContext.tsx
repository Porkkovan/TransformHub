"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession, signOut, SessionProvider } from "next-auth/react";
import type { Role } from "@/lib/rbac";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: Role;
  organizationId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  logout: async () => {},
});

function AuthContextInner({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const user: AuthUser | null = session?.user
    ? {
        id: (session.user as any).id,
        email: session.user.email ?? "",
        name: session.user.name ?? undefined,
        role: (session.user as any).role ?? "VIEWER",
        organizationId: (session.user as any).organizationId,
      }
    : null;

  const logout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: status === "loading",
        isAuthenticated: status === "authenticated",
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextInner>{children}</AuthContextInner>
    </SessionProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
