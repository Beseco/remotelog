import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { randomBytes } from "crypto";

// In-memory store: sessionToken → SSH credentials + TTL
// Entries are cleaned up after use or after 60 seconds.
interface SshSession {
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey?: string;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __sshSessions: Map<string, SshSession> | undefined;
}
globalThis.__sshSessions ??= new Map<string, SshSession>();
export const sshSessions: Map<string, SshSession> = globalThis.__sshSessions;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { remoteIdId } = await req.json() as { remoteIdId?: string };
  if (!remoteIdId) return NextResponse.json({ error: "remoteIdId required" }, { status: 400 });

  // Load RemoteId — must belong to org
  const remoteId = await prisma.remoteId.findFirst({
    where: {
      id: remoteIdId,
      type: "ssh",
      device: { organizationId: session.user.organizationId },
    },
    select: { remoteId: true, sshUser: true, sshPasswordEnc: true, sshPrivateKeyEnc: true },
  });

  if (!remoteId) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (!remoteId.sshUser) return NextResponse.json({ error: "Kein SSH-Benutzer konfiguriert" }, { status: 400 });

  const password = remoteId.sshPasswordEnc ? decrypt(remoteId.sshPasswordEnc) : "";
  const privateKey = remoteId.sshPrivateKeyEnc ? decrypt(remoteId.sshPrivateKeyEnc) : undefined;

  // Parse host:port
  const [host, portStr] = remoteId.remoteId.split(":");
  const port = portStr ? parseInt(portStr, 10) : 22;

  const token = randomBytes(16).toString("hex");
  sshSessions.set(token, {
    host,
    port,
    username: remoteId.sshUser,
    password,
    privateKey,
    expiresAt: Date.now() + 60_000,
  });

  // Clean expired sessions
  for (const [k, v] of sshSessions.entries()) {
    if (v.expiresAt < Date.now()) sshSessions.delete(k);
  }

  return NextResponse.json({ token });
}
