import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const remoteIdId = searchParams.get("remoteId");
  if (!remoteIdId) return NextResponse.json({ error: "remoteId required" }, { status: 400 });

  const remoteId = await prisma.remoteId.findFirst({
    where: {
      id: remoteIdId,
      type: "ssh",
      device: { organizationId: session.user.organizationId },
    },
    select: { remoteId: true, sshUser: true, sshPasswordEnc: true, label: true },
  });

  if (!remoteId) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const [host, portStr] = remoteId.remoteId.split(":");
  const port = portStr ?? "22";
  const user = remoteId.sshUser ?? "root";
  const password = remoteId.sshPasswordEnc ? decrypt(remoteId.sshPasswordEnc) : "";

  // Escape values for batch file — avoid special chars breaking the script
  const safe = (s: string) => s.replace(/["%]/g, "");

  const bat = `@echo off
rem RemoteLog SSH-Verbindung — ${safe(remoteId.label ?? host)}
putty.exe -ssh ${safe(user)}@${safe(host)} -P ${safe(port)}${password ? ` -pw "${safe(password)}"` : ""}
`;

  const filename = `ssh-${safe(host)}.bat`;
  return new NextResponse(bat, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
