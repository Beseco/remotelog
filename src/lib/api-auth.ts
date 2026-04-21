import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { headers } from "next/headers";

export type ApiUser = {
  id: string;
  organizationId: string;
  role: string;
  name: string;
};

/**
 * Authenticates a request via API key (Authorization: Bearer rl_xxx)
 * or falls back to NextAuth cookie session.
 * Used by routes that need to be accessible from the desktop app.
 */
export async function apiAuth(): Promise<ApiUser | null> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (authHeader?.startsWith("Bearer rl_")) {
    const keyHash = crypto
      .createHash("sha256")
      .update(authHeader.slice(7))
      .digest("hex");

    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            organizationId: true,
            role: true,
            name: true,
            active: true,
          },
        },
      },
    });

    if (!key || !key.active || !key.user.active) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    // Update lastUsedAt without blocking the request
    void prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: key.user.id,
      organizationId: key.user.organizationId,
      role: key.user.role,
      name: key.user.name,
    };
  }

  // Fall back to NextAuth cookie session
  const session = await auth();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role ?? "techniker",
    name: session.user.name ?? "",
  };
}
