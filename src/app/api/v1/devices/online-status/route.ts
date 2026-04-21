import { NextResponse } from "next/server";
import { connect } from "net";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// ─── TCP reachability check ───────────────────────────────────────────────────

function tcpCheck(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, host);
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
    socket.on("connect", () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}

// ─── hbbs API: fetch online peer IDs ─────────────────────────────────────────

async function fetchHbbsOnlinePeerIds(serverUrl: string, password: string): Promise<Set<string> | null> {
  try {
    // hbbs listens on port 21114 for its HTTP admin API
    const base = serverUrl.includes(":") ? serverUrl : `${serverUrl}:21114`;
    const apiBase = base.startsWith("http") ? base : `http://${base}`;

    // 1. Login → access token
    const loginRes = await fetch(`${apiBase}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password, autoLogin: true, type: "account" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!loginRes.ok) return null;

    const loginData = await loginRes.json() as { access_token?: string };
    const token = loginData.access_token;
    if (!token) return null;

    // 2. Fetch peers (paginated — first page is enough for status)
    const peersRes = await fetch(`${apiBase}/api/peers?current=1&status=1&pageSize=1000`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!peersRes.ok) return null;

    const peersData = await peersRes.json() as { data?: { id?: string; status?: string; online?: boolean }[] } | { id?: string; status?: string; online?: boolean }[];
    const rows = Array.isArray(peersData) ? peersData : (peersData as { data?: unknown[] }).data ?? [];

    const onlineIds = new Set<string>();
    for (const peer of rows) {
      if (!peer || typeof peer !== "object") continue;
      const p = peer as { id?: string; status?: string; online?: boolean };
      const isOnline = p.status === "online" || p.online === true;
      if (isOnline && p.id) onlineIds.add(String(p.id));
    }
    return onlineIds;
  } catch {
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [devices, org] = await Promise.all([
    prisma.device.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        ipAddress: true,
        tags: true,
        remoteIds: { select: { type: true, remoteId: true } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { rustdeskIdServer: true, rustdeskApiPasswordEnc: true },
    }),
  ]);

  // Fetch hbbs peer statuses once (shared across all RustDesk devices)
  let hbbsOnlineIds: Set<string> | null = null;
  if (org?.rustdeskIdServer && org.rustdeskApiPasswordEnc) {
    try {
      const password = decrypt(org.rustdeskApiPasswordEnc);
      hbbsOnlineIds = await fetchHbbsOnlinePeerIds(org.rustdeskIdServer, password);
    } catch { /* ignore decrypt / network errors */ }
  }

  type Status = "online" | "offline" | "unknown";

  const checks = await Promise.allSettled(
    devices.map(async (device): Promise<{ id: string; status: Status }> => {
      // ── RustDesk: use hbbs API if available ──────────────────────────────
      const rustdeskRemote = device.remoteIds.find((r) => r.type === "rustdesk");
      if (rustdeskRemote) {
        if (hbbsOnlineIds !== null) {
          return { id: device.id, status: hbbsOnlineIds.has(rustdeskRemote.remoteId) ? "online" : "offline" };
        }
        // No hbbs API — fall through to TCP check on ipAddress if available
      }

      // ── SSH remoteId → TCP check ─────────────────────────────────────────
      const sshRemote = device.remoteIds.find((r) => r.type === "ssh");
      if (sshRemote) {
        const [host, portStr] = sshRemote.remoteId.split(":");
        const port = portStr ? parseInt(portStr, 10) : 22;
        if (host) {
          const ok = await tcpCheck(host, port);
          return { id: device.id, status: ok ? "online" : "offline" };
        }
      }

      // ── Fallback: ipAddress — try common ports ───────────────────────────
      if (device.ipAddress) {
        const ip = device.ipAddress;
        const ok = await tcpCheck(ip, 22)
          .then((r) => r || tcpCheck(ip, 80))
          .then((r) => r || tcpCheck(ip, 443));
        return { id: device.id, status: ok ? "online" : "offline" };
      }

      return { id: device.id, status: "unknown" };
    })
  );

  const result: Record<string, Status> = {};
  for (const c of checks) {
    if (c.status === "fulfilled") result[c.value.id] = c.value.status;
  }
  return NextResponse.json(result);
}
