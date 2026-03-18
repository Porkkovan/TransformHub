import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// ─── RBAC role hierarchy ──────────────────────────────────────────────────────
// VIEWER     — read-only dashboards
// ANALYST    — run agents, view all data
// ADMIN      — manage org settings, users, context docs
// SUPER_ADMIN — platform-wide access across all orgs
export const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  ANALYST: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function hasRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[requiredRole] ?? 999);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // ── Email / password ──────────────────────────────────────────────────────
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        // Update last login timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {}); // non-blocking

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),

    // ── Google OAuth (SSO for Google Workspace customers) ─────────────────────
    // Enable by setting GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars.
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),

    // ── Microsoft Entra ID / Azure AD (SSO for enterprise) ───────────────────
    // Enable by setting AZURE_AD_CLIENT_ID + AZURE_AD_CLIENT_SECRET + AZURE_AD_TENANT_ID
    ...(process.env.AZURE_AD_CLIENT_ID
      ? [
          MicrosoftEntraID({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth sign-ins: provision or update the user record
      if (account?.provider && account.provider !== "credentials") {
        const email = user.email;
        if (!email) return false;

        const existingUser = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        });

        if (!existingUser) {
          // Look up SSO config by email domain to assign org + default role
          const domain = email.split("@")[1];
          const ssoConfig = domain
            ? await prisma.ssoConfig.findFirst({
                where: { domain, isActive: true },
              })
            : null;

          await prisma.user.create({
            data: {
              id: user.id ?? crypto.randomUUID(),
              email,
              name: user.name ?? profile?.name ?? email.split("@")[0],
              role: ssoConfig?.defaultRole ?? "ANALYST",
              organizationId: ssoConfig?.organizationId ?? null,
              lastLoginAt: new Date(),
            },
          });
        } else {
          // Update last login
          await prisma.user.update({
            where: { email },
            data: { lastLoginAt: new Date() },
          }).catch(() => {});
        }
      }
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
        token.userId = user.id;
      }
      // Support session.update() to refresh role/org from DB
      if (trigger === "update" && session?.refreshFromDb) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub! },
          select: { role: true, organizationId: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub ?? token.userId;
        (session.user as any).role = token.role ?? "ANALYST";
        (session.user as any).organizationId = token.organizationId;
      }
      return session;
    },
  },
});
