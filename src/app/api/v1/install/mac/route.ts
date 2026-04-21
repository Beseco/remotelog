import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

function escapeShell(value: string): string {
  return value.replace(/'/g, "'\\''");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionToken = searchParams.get("s")?.toUpperCase();

  if (!sessionToken || !/^[A-Z0-9]{8}$/.test(sessionToken)) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 400 });
  }

  const baseUrl = (process.env.NEXTAUTH_URL ?? "https://app.remotelog.de").replace(/\/$/, "");
  const org = await loadOrgBySession(sessionToken);

  const idServer = org?.rustdeskIdServer ?? "";
  const relay    = org?.rustdeskRelay ?? "";
  const key      = org?.rustdeskKey ?? "";

  // Config block — only written if custom server is set
  const configBlock = idServer ? `
# Custom RustDesk server configuration
CONFIG_DIR="$HOME/Library/Application Support/com.carriez.RustDesk"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/RustDesk2.toml" << 'TOMLEOF'
[options]
custom-rendezvous-server = "${escapeShell(idServer)}"
${relay ? `relay-server = "${escapeShell(relay)}"` : ""}
${key ? `rs-pub-key = "${escapeShell(key)}"` : ""}
TOMLEOF
echo "  Server-Konfiguration geschrieben."
` : "";

  const script = `#!/bin/bash
set -e

REPORT_URL='${escapeShell(baseUrl)}/api/v1/install/report'
SESSION_TOKEN='${sessionToken}'
RUSTDESK_VERSION='1.4.0'
RUSTDESK_DMG_URL="https://github.com/rustdesk/rustdesk/releases/download/$RUSTDESK_VERSION/rustdesk-$RUSTDESK_VERSION-x86_64.dmg"
RUSTDESK_APP="/Applications/RustDesk.app"
RUSTDESK_BIN="$RUSTDESK_APP/Contents/MacOS/rustdesk"

clear
echo "================================================="
echo "  RemoteLog Fernwartungs-Setup"
echo "================================================="
echo ""

# [1/4] Download
echo "[1/4] RustDesk wird heruntergeladen..."
DMG_PATH="$(mktemp /tmp/rustdesk-XXXXXX.dmg)"
curl -fsSL --progress-bar -o "$DMG_PATH" "$RUSTDESK_DMG_URL"

# [2/4] Install
echo "[2/4] RustDesk wird installiert..."
hdiutil attach -nobrowse -quiet "$DMG_PATH"
cp -r "/Volumes/RustDesk/RustDesk.app" /Applications/
hdiutil detach "/Volumes/RustDesk" -quiet 2>/dev/null || true
rm -f "$DMG_PATH"
echo "  Installation abgeschlossen."

# [3/4] Configure
echo "[3/4] Verbindung wird konfiguriert..."
${configBlock}
# Generate random password (12 chars, no ambiguous chars)
CHARSET='ABCDEFGHJKMNPQRSTUVWXYZ23456789'
PASSWORD=''
for i in $(seq 1 12); do
  idx=$((RANDOM % \${#CHARSET}))
  PASSWORD="$PASSWORD\${CHARSET:$idx:1}"
done

"$RUSTDESK_BIN" --password "$PASSWORD" 2>/dev/null || true
sleep 3

# [4/4] Report
echo "[4/4] Geraet wird registriert..."
COMPUTER_NAME="$(scutil --get ComputerName 2>/dev/null || hostname)"
RUSTDESK_ID="$("$RUSTDESK_BIN" --get-id 2>/dev/null | tr -d '[:space:]')"

if [ -z "$RUSTDESK_ID" ]; then
  # Fallback: read from config
  CONFIG_TOML="$HOME/Library/Application Support/com.carriez.RustDesk/RustDesk.toml"
  if [ -f "$CONFIG_TOML" ]; then
    RUSTDESK_ID=$(grep '^id = ' "$CONFIG_TOML" | sed 's/id = "//;s/"//')
  fi
fi

if [ -z "$RUSTDESK_ID" ]; then
  echo "Fehler: RustDesk-ID konnte nicht gelesen werden." >&2
  read -r -p "Druecken Sie ENTER zum Beenden..." _
  exit 1
fi

curl -fsSL -X POST "$REPORT_URL" \\
  -H 'Content-Type: application/json' \\
  -d "{\\\"sessionToken\\\":\\\"$SESSION_TOKEN\\\",\\\"rustdeskId\\\":\\\"$RUSTDESK_ID\\\",\\\"password\\\":\\\"$PASSWORD\\\",\\\"computerName\\\":\\\"$COMPUTER_NAME\\\"}" \\
  > /dev/null

echo ""
echo "================================================="
echo "  Installation erfolgreich abgeschlossen!"
echo "  Ihr Techniker kann nun auf dieses Geraet"
echo "  zugreifen wenn Sie es wuenschen."
echo "================================================="
read -r -p "Druecken Sie ENTER zum Beenden..." _
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="remotelog-setup-${sessionToken}.command"`,
      "Content-Length": Buffer.byteLength(script).toString(),
    },
  });
}
