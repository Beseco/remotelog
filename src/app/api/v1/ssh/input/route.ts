import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sshShells, sshKbHandlers } from "../stream/route";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, data } = await req.json() as { token?: string; data?: string };
  if (!token || data === undefined) {
    return NextResponse.json({ error: "token and data required" }, { status: 400 });
  }

  const kbHandler = sshKbHandlers.get(token);
  if (kbHandler) {
    kbHandler(data);
    return NextResponse.json({ ok: true });
  }

  const shell = sshShells.get(token);
  if (!shell) {
    return NextResponse.json({ error: "Keine aktive SSH-Verbindung" }, { status: 404 });
  }

  shell.write(data, "utf8");
  return NextResponse.json({ ok: true });
}
