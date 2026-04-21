import type { NextAuthConfig } from "next-auth";

// Lightweight auth config for Edge runtime (no Prisma)
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Allow health check and auth routes
      if (pathname.startsWith("/api/health") || pathname.startsWith("/api/auth")) {
        return true;
      }

      // Short installer token at root (e.g. /AB3X7K) — 6 uppercase alphanumeric chars
      if (/^\/[A-Z0-9]{6}$/i.test(pathname)) return true;

      // Public reseller routes (registration, e-mail verification, pricing)
      const publicPaths = ["/register", "/verify", "/pricing", "/ssh-terminal"];
      const publicApiPaths = [
        "/api/v1/reseller/register",
        "/api/v1/reseller/verify",
        "/api/v1/reseller/plans",
        "/api/v1/reseller/webhook",
        "/api/v1/reseller/subscribe/return",
        "/api/v1/install/script",
        "/api/v1/install/report",
        "/api/v1/install/session",
        "/api/v1/install/exe",
        "/api/v1/install/mac",
      ];
      if (
        publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
        publicApiPaths.some((p) => pathname.startsWith(p))
      ) {
        return true;
      }

      // Redirect authenticated users away from login
      if (pathname === "/login" && isLoggedIn) {
        return Response.redirect(new URL("/", nextUrl));
      }

      // Require auth for everything else
      if (!isLoggedIn) {
        return false;
      }

      return true;
    },
  },
  providers: [], // Providers defined in auth.ts
};
