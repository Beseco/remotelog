import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/verify?error=missing", req.nextUrl.origin));
  }

  const user = await prisma.user.findUnique({
    where: { verificationToken: token },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/verify?error=invalid", req.nextUrl.origin));
  }

  if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
    return NextResponse.redirect(new URL("/verify?error=expired", req.nextUrl.origin));
  }

  if (user.emailVerifiedAt) {
    // Already verified — go to login
    return NextResponse.redirect(new URL("/login?verified=1", req.nextUrl.origin));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      verificationToken: null,
      verificationTokenExpiresAt: null,
    },
  });

  return NextResponse.redirect(new URL("/verify?success=1", req.nextUrl.origin));
}
