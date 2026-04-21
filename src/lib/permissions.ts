import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type UserRole = "admin" | "techniker" | "readonly";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "admin") {
    throw new Error("Keine Berechtigung");
  }
  return session;
}

export function isAdmin(role: string) {
  return role === "admin";
}

export function canEdit(role: string) {
  return role === "admin" || role === "techniker";
}
