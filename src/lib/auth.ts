import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limiting by IP
        const headersList = await headers();
        const ip =
          headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          headersList.get("x-real-ip") ??
          "unknown";
        const rateLimit = await checkLoginRateLimit(ip);
        if (!rateLimit.allowed) {
          throw new Error(`Zu viele Versuche. Bitte ${rateLimit.retryAfter}s warten.`);
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            active: true,
            organizationId: true,
            verificationToken: true,
          },
        });

        if (!user || !user.active) return null;

        // In RESELLER_MODE: block login only if the user registered via
        // the reseller flow and hasn't clicked the verification link yet.
        // Existing/seeded users (no token) are always allowed.
        if (process.env.RESELLER_MODE && user.verificationToken) {
          throw new Error("Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.");
        }

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!passwordValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.organizationId = (user as { organizationId?: string }).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { organizationId?: string }).organizationId = token.organizationId as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
