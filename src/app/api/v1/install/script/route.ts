import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const orgToken = searchParams.get("org") ?? "";
  const email = searchParams.get("email") ?? "";
  const os = searchParams.get("os") === "linux" ? "linux" : "windows";

  const org = await prisma.organization.findUnique({
    where: { registrationToken: orgToken },
    select: { id: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 404 });
  }

  const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const reportUrl = `${baseUrl}/api/v1/install/report`;

  if (os === "windows") {
    const script = buildWindowsScript({ email, orgToken, reportUrl });
    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="remotelog-setup.ps1"`,
      },
    });
  } else {
    const script = buildLinuxScript({ email, orgToken, reportUrl });
    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="remotelog-setup.sh"`,
      },
    });
  }
}

function buildWindowsScript({
  email,
  orgToken,
  reportUrl,
}: {
  email: string;
  orgToken: string;
  reportUrl: string;
}) {
  return `# RemoteLog Fernwartungs-Setup
# Bitte als Administrator ausfuehren

$ErrorActionPreference = "Stop"
$email = "${email.replace(/"/g, '`"')}"
$orgToken = "${orgToken}"
$reportUrl = "${reportUrl}"

Write-Host "RemoteLog Fernwartungs-Setup wird gestartet..." -ForegroundColor Cyan

# --- 1. RustDesk herunterladen ---
Write-Host "Lade RustDesk herunter..."
$rustdeskUrl = "https://github.com/rustdesk/rustdesk/releases/latest/download/rustdesk-1.3.8-x86_64.exe"
$installer = "$env:TEMP\\rustdesk-setup.exe"
try {
    Invoke-WebRequest -Uri $rustdeskUrl -OutFile $installer -UseBasicParsing
} catch {
    Write-Host "Fehler beim Download. Bitte pruefen Sie Ihre Internetverbindung." -ForegroundColor Red
    exit 1
}

# --- 2. RustDesk installieren ---
Write-Host "Installiere RustDesk..."
Start-Process -FilePath $installer -ArgumentList "--silent-install" -Wait -NoNewWindow
Start-Sleep -Seconds 5

# Moegliche Installationspfade
$rustdeskExe = $null
$searchPaths = @(
    "$env:ProgramFiles\\RustDesk\\rustdesk.exe",
    "$env:ProgramFiles(x86)\\RustDesk\\rustdesk.exe",
    "$env:APPDATA\\RustDesk\\rustdesk.exe"
)
foreach ($p in $searchPaths) {
    if (Test-Path $p) { $rustdeskExe = $p; break }
}
if (-not $rustdeskExe) {
    Write-Host "RustDesk wurde nicht gefunden. Bitte manuell installieren." -ForegroundColor Red
    exit 1
}

# --- 3. Zufaelliges Passwort generieren ---
$chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
$password = -join ((1..12) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

# --- 4. Passwort setzen ---
Write-Host "Setze Zugangsdaten..."
& $rustdeskExe --password $password | Out-Null
Start-Sleep -Seconds 3

# --- 5. RustDesk-ID auslesen ---
$rustdeskId = & $rustdeskExe --get-id 2>$null
if (-not $rustdeskId -or $rustdeskId.Trim() -eq "") {
    # Fallback: aus Konfigurationsdatei lesen
    $configFile = "$env:APPDATA\\RustDesk\\config\\RustDesk.toml"
    if (Test-Path $configFile) {
        $line = Get-Content $configFile | Where-Object { $_ -match '^id\\s*=' }
        if ($line) { $rustdeskId = ($line -split '=')[1].Trim().Trim('"') }
    }
}
$rustdeskId = $rustdeskId.Trim()

# --- 6. Computername auslesen ---
$computerName = $env:COMPUTERNAME

Write-Host "RustDesk-ID: $rustdeskId" -ForegroundColor Green

# --- 7. Bei RemoteLog registrieren ---
Write-Host "Registriere Geraet bei RemoteLog..."
$body = @{
    orgToken     = $orgToken
    email        = $email
    computerName = $computerName
    rustdeskId   = $rustdeskId
    password     = $password
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $reportUrl -Method POST -Body $body -ContentType "application/json"
    Write-Host "Geraet erfolgreich registriert!" -ForegroundColor Green
} catch {
    Write-Host "Warnung: Registrierung bei RemoteLog fehlgeschlagen: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installation abgeschlossen!" -ForegroundColor Green
Write-Host "RustDesk laeuft im Hintergrund und ist bereit fuer Fernzugriff."
Write-Host ""
Write-Host "Bitte lassen Sie dieses Fenster geoeffnet bis Ihr Techniker bestaetigt hat"
Write-Host "dass das Geraet in RemoteLog erscheint."
Write-Host ""
Read-Host "Druecken Sie Enter zum Beenden"
`;
}

function buildLinuxScript({
  email,
  orgToken,
  reportUrl,
}: {
  email: string;
  orgToken: string;
  reportUrl: string;
}) {
  return `#!/bin/bash
# RemoteLog Fernwartungs-Setup
# Bitte mit sudo ausfuehren: sudo bash remotelog-setup.sh

set -e

EMAIL="${email.replace(/"/g, '\\"')}"
ORG_TOKEN="${orgToken}"
REPORT_URL="${reportUrl}"

echo "RemoteLog Fernwartungs-Setup wird gestartet..."

# --- 1. RustDesk herunterladen ---
echo "Lade RustDesk herunter..."
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    RUSTDESK_URL="https://github.com/rustdesk/rustdesk/releases/latest/download/rustdesk-1.3.8-x86_64.deb"
    PKG="rustdesk.deb"
elif [ "$ARCH" = "aarch64" ]; then
    RUSTDESK_URL="https://github.com/rustdesk/rustdesk/releases/latest/download/rustdesk-1.3.8-aarch64.deb"
    PKG="rustdesk.deb"
else
    echo "Nicht unterstuetzte Architektur: $ARCH"
    exit 1
fi

curl -L "$RUSTDESK_URL" -o "/tmp/$PKG"

# --- 2. RustDesk installieren ---
echo "Installiere RustDesk..."
if command -v dpkg &>/dev/null; then
    dpkg -i "/tmp/$PKG" || apt-get install -f -y
elif command -v rpm &>/dev/null; then
    rpm -i "/tmp/$PKG"
fi
sleep 3

# --- 3. Zufaelliges Passwort generieren ---
PASSWORD=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 12)

# --- 4. Passwort setzen ---
echo "Setze Zugangsdaten..."
rustdesk --password "$PASSWORD" &>/dev/null || true
sleep 3

# --- 5. RustDesk-ID auslesen ---
RUSTDESK_ID=$(rustdesk --get-id 2>/dev/null | tr -d '\\n' || echo "")
if [ -z "$RUSTDESK_ID" ]; then
    CONFIG_FILE="$HOME/.config/rustdesk/RustDesk.toml"
    if [ -f "$CONFIG_FILE" ]; then
        RUSTDESK_ID=$(grep '^id' "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' "\\n')
    fi
fi

# --- 6. Computername auslesen ---
COMPUTER_NAME=$(hostname)

echo "RustDesk-ID: $RUSTDESK_ID"

# --- 7. Bei RemoteLog registrieren ---
echo "Registriere Geraet bei RemoteLog..."
curl -s -X POST "$REPORT_URL" \\
    -H "Content-Type: application/json" \\
    -d "{\\\"orgToken\\\":\\\"$ORG_TOKEN\\\",\\\"email\\\":\\\"$EMAIL\\\",\\\"computerName\\\":\\\"$COMPUTER_NAME\\\",\\\"rustdeskId\\\":\\\"$RUSTDESK_ID\\\",\\\"password\\\":\\\"$PASSWORD\\\"}" \\
    && echo "Geraet erfolgreich registriert!" || echo "Warnung: Registrierung fehlgeschlagen"

echo ""
echo "Installation abgeschlossen!"
echo "RustDesk laeuft und ist bereit fuer Fernzugriff."
`;
}
