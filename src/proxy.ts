import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextRequest, NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const MOBILE_UA = /iPhone|iPad|iPod|Android|Mobile/i;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export const proxy = auth((request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // CORS preflight for desktop app
  if (request.method === "OPTIONS" && pathname.startsWith("/api/v1/")) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Add CORS headers to all API v1 responses
  if (pathname.startsWith("/api/v1/")) {
    const response = NextResponse.next();
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  const ua = request.headers.get("user-agent") ?? "";
  const isMobile = MOBILE_UA.test(ua);
  const prefersFullView = request.cookies.has("prefer-full-view");

  if (
    isMobile &&
    !prefersFullView &&
    !pathname.startsWith("/mobile") &&
    !pathname.startsWith("/api") &&
    pathname !== "/login" &&
    pathname !== "/setup"
  ) {
    return NextResponse.redirect(new URL("/mobile", request.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-).*)"],
};
