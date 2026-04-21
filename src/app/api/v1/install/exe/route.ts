import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";

const MARKERS: Record<string, { marker: Buffer; fieldLen: number }> = {
  baseUrl:    { marker: Buffer.from("RLBASEURL:"),  fieldLen: 90 },
  idServer:   { marker: Buffer.from("RDIDSERVER:"), fieldLen: 89 },
  relay:      { marker: Buffer.from("RDRELAY000:"), fieldLen: 89 },
  key:        { marker: Buffer.from("RDKEY00000:"), fieldLen: 89 },
};

function patchBinary(
  exe: Buffer,
  patches: { markerKey: string; value: string }[]
): Buffer {
  const patched = Buffer.from(exe);
  for (const { markerKey, value } of patches) {
    const { marker, fieldLen } = MARKERS[markerKey];
    const idx = patched.indexOf(marker);
    if (idx === -1) continue;
    const buf = Buffer.alloc(fieldLen, 0);
    Buffer.from(value.slice(0, fieldLen - 1)).copy(buf);
    buf.copy(patched, idx + marker.length, 0, fieldLen);
  }
  return patched;
}

async function loadOrgBySession(sessionToken: string) {
  const reg = await prisma.deviceRegistration.findUnique({
    where: { sessionToken },
    select: { organizationId: true },
  });
  if (!reg) return null;
  return prisma.organization.findUnique({
    where: { id: reg.organizationId },
    select: { rustdeskIdServer: true, rustdeskRelay: true, rustdeskKey: true },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionToken = searchParams.get("s")?.toUpperCase();

  if (!sessionToken || !/^[A-Z0-9]{8}$/.test(sessionToken)) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 400 });
  }

  const exePath = join(process.cwd(), "public", "install", "remotelog-setup.exe");
  let exeBuffer: Buffer;
  try {
    exeBuffer = await readFile(exePath);
  } catch {
    return NextResponse.json({ error: "Installer nicht gefunden" }, { status: 500 });
  }

  const baseUrl = (process.env.NEXTAUTH_URL ?? "https://app.remotelog.de").replace(/\/$/, "");
  const org = await loadOrgBySession(sessionToken);

  const patched = patchBinary(exeBuffer, [
    { markerKey: "baseUrl",  value: baseUrl },
    { markerKey: "idServer", value: org?.rustdeskIdServer ?? "" },
    { markerKey: "relay",    value: org?.rustdeskRelay ?? "" },
    { markerKey: "key",      value: org?.rustdeskKey ?? "" },
  ]);

  return new NextResponse(patched.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="remotelog-setup-${sessionToken}.exe"`,
      "Content-Length": patched.length.toString(),
    },
  });
}
