import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { log } from "@/lib/log";

const nextAuthSecret = process.env.NEXTAUTH_SECRET;
const usingRealAuth = process.env.NEXT_PUBLIC_USE_REAL_AUTH === "true";
if (!nextAuthSecret && usingRealAuth && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET is required for NextAuth to run in production.");
}

export const authOptions: NextAuthOptions = {
  ...(nextAuthSecret ? { secret: nextAuthSecret } : {}),
  trustHost: process.env.NEXTAUTH_TRUST_HOST === "true",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "mom" },
        password: { label: "Password", type: "password", placeholder: "••••••••" },
      },
      async authorize(credentials) {
        const { verifyAuthIdentityCredentials } = await import(
          "@/lib/auth/authIdentity.server"
        );
        const username = (credentials?.username ?? "").trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!username || !password) {
          log.warn({
            module: "auth",
            message: "auth.credentialsMissing",
            data: { hasUsername: !!username, hasPassword: !!password },
          });
          return null;
        }
        const identity = await verifyAuthIdentityCredentials(username, password);
        if (!identity) {
          log.warn({
            module: "auth",
            message: "auth.credentialsInvalid",
            data: { username },
          });
          return null;
        }

        return {
          id: identity.userId,
          name: identity.name,
          email: `${identity.userId}@menuplanner.local`,
          role: identity.role,
          familyId: identity.familyId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  callbacks: {
    async jwt({ token, user }) {
      log.info({
        module: "auth",
        message: "auth.jwt",
        data: { hasUser: !!user, hasTokenUserId: typeof token.userId === "string" },
      });
      if (user) {
        token.userId = user.id;
        token.familyId = (user as { familyId?: string }).familyId ?? null;
        token.role = (user as { role?: string }).role ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      log.info({
        module: "auth",
        message: "auth.session",
        data: { hasUserId: !!token.userId },
      });
      if (session.user && token.userId) {
        const sessionUser = session.user as {
          id?: string;
          familyId?: string;
          role?: string;
        };
        sessionUser.id = token.userId as string;
        if (typeof token.familyId === "string") {
          sessionUser.familyId = token.familyId;
        }
        if (typeof token.role === "string") {
          sessionUser.role = token.role;
        }
      }
      return session;
    },
  },
};

