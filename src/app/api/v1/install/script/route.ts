import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function loadOrgBySession(sessionToken: string) {
  const reg = await prisma.deviceRegistration.findUnique({
    where: { sessionToken },
    select: { organizationId: true, email: true },
  });
  if (!reg) return null;
  const org = await prisma.organization.findUnique({
    where: { id: reg.organizationId },
    select: { rustdeskIdServer: true, rustdeskRelay: true, rustdeskKey: true },
  });
  return { org, email: reg.email ?? "" };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionToken = searchParams.get("s")?.toUpperCase();
  const os = searchParams.get("os") === "linux" ? "linux" : "windows";

  if (!sessionToken || !/^[A-Z0-9]{8}$/.test(sessionToken)) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 400 });
  }

  const result = await loadOrgBySession(sessionToken);
  if (!result) {
    return NextResponse.json({ error: "Token nicht gefunden" }, { status: 404 });
  }

  const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const reportUrl = `${baseUrl}/api/v1/install/report`;
  const { org, email } = result;

  if (os === "linux") {
    const script = buildLinuxScript({
      sessionToken,
      email,
      reportUrl,
      idServer: org?.rustdeskIdServer ?? "",
      relay: org?.rustdeskRelay ?? "",
      key: org?.rustdeskKey ?? "",
    });
    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="remotelog-setup.sh"`,
      },
    });
  }

  const cmd = buildWindowsCmd({
    sessionToken,
    email,
    reportUrl,
    idServer: org?.rustdeskIdServer ?? "",
    relay: org?.rustdeskRelay ?? "",
    key: org?.rustdeskKey ?? "",
  });

  return new NextResponse(cmd, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="remotelog-setup.cmd"`,
    },
  });
}

function buildWindowsCmd(p: {
  sessionToken: string;
  email: string;
  reportUrl: string;
  idServer: string;
  relay: string;
  key: string;
}): string {
  // Build the PowerShell script as a plain string
  const ps = buildWindowsPowerShell(p);

  // PowerShell -EncodedCommand expects UTF-16LE Base64
  const encoded = Buffer.from(ps, "utf16le").toString("base64");

  // CMD wrapper: self-elevates via UAC, then runs encoded PowerShell
  const cmd = [
    "@echo off",
    "net session >nul 2>&1 || (",
    "    powershell -Command \"Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs\"",
    "    exit /b",
    ")",
    `powershell -ExecutionPolicy Bypass -NoProfile -EncodedCommand ${encoded}`,
    "exit /b",
  ].join("\r\n");

  return cmd;
}

function buildWindowsPowerShell(p: {
  sessionToken: string;
  email: string;
  reportUrl: string;
  idServer: string;
  relay: string;
  key: string;
}): string {
  const q = (s: string) => s.replace(/"/g, '\\"');
  const lines: string[] = [];

  lines.push("$ErrorActionPreference = 'Stop'");
  lines.push(`$sessionToken = '${p.sessionToken}'`);
  lines.push(`$email        = '${p.email.replace(/'/g, "''")}'`);
  lines.push(`$reportUrl    = '${p.reportUrl}'`);
  lines.push("");
  lines.push("Write-Host ''");
  lines.push("Write-Host '=================================================' -ForegroundColor Cyan");
  lines.push("Write-Host '  RemoteLog Fernwartungs-Setup'                    -ForegroundColor Cyan");
  lines.push("Write-Host '=================================================' -ForegroundColor Cyan");
  lines.push("Write-Host ''");
  lines.push("");

  // Step 1: Download
  lines.push("Write-Host '[1/4] RustDesk wird heruntergeladen...' -ForegroundColor White");
  lines.push("$rustdeskUrl = 'https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-x86_64.exe'");
  lines.push("$installer   = \"$env:TEMP\\rustdesk-installer.exe\"");
  lines.push("try {");
  lines.push("    Invoke-WebRequest -Uri $rustdeskUrl -OutFile $installer -UseBasicParsing");
  lines.push("} catch {");
  lines.push("    Write-Host 'Fehler beim Download.' -ForegroundColor Red");
  lines.push("    Read-Host 'Enter druecken zum Beenden'");
  lines.push("    exit 1");
  lines.push("}");
  lines.push("");

  // Step 2: Install
  lines.push("Write-Host '[2/4] RustDesk wird installiert...' -ForegroundColor White");
  lines.push("Start-Process -FilePath $installer -ArgumentList '--silent-install' -Wait -NoNewWindow");
  lines.push("Start-Sleep -Seconds 5");
  lines.push("");
  lines.push("$rustdeskExe = $null");
  lines.push("@(\"$env:ProgramFiles\\RustDesk\\rustdesk.exe\", \"$env:ProgramFiles\\RustDesk\\rustdesk.exe\") | ForEach-Object {");
  lines.push("    if (-not $rustdeskExe -and (Test-Path $_)) { $rustdeskExe = $_ }");
  lines.push("}");
  lines.push("if (-not $rustdeskExe) {");
  lines.push("    Write-Host 'RustDesk wurde nicht gefunden.' -ForegroundColor Red");
  lines.push("    Read-Host 'Enter druecken zum Beenden'");
  lines.push("    exit 1");
  lines.push("}");
  lines.push("");

  // Server config
  if (p.idServer) {
    lines.push("$configDir = \"$env:APPDATA\\RustDesk\\config\"");
    lines.push("if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }");
    lines.push(`@('relay_server = \"${q(p.relay)}\"', 'id_server = \"${q(p.idServer)}\"', 'key = \"${q(p.key)}\"') -join \`n | Set-Content \"$configDir\\RustDesk2.toml\" -Encoding UTF8`);
    lines.push("");
  }

  // Step 3: Password
  lines.push("Write-Host '[3/4] Zugangsdaten werden gesetzt...' -ForegroundColor White");
  lines.push("$chars    = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'");
  lines.push("$password = -join ((1..12) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })");
  lines.push("& $rustdeskExe --password $password | Out-Null");
  lines.push("Start-Sleep -Seconds 3");
  lines.push("");

  // Step 4: Register
  lines.push("Write-Host '[4/4] Geraet wird registriert...' -ForegroundColor White");
  lines.push("$rustdeskId = (& $rustdeskExe --get-id 2>$null) -replace '\\s',''");
  lines.push("if (-not $rustdeskId) {");
  lines.push("    $cfg = \"$env:APPDATA\\RustDesk\\config\\RustDesk.toml\"");
  lines.push("    if (Test-Path $cfg) {");
  lines.push("        $ln = Get-Content $cfg | Where-Object { $_ -match '^id\\s*=' }");
  lines.push("        if ($ln) { $rustdeskId = ($ln -split '=',2)[1].Trim().Trim('\"') }");
  lines.push("    }");
  lines.push("}");
  lines.push("");
  lines.push("$body = @{ sessionToken=$sessionToken; email=$email; computerName=$env:COMPUTERNAME; rustdeskId=$rustdeskId; password=$password } | ConvertTo-Json");
  lines.push("try {");
  lines.push("    Invoke-RestMethod -Uri $reportUrl -Method POST -Body $body -ContentType 'application/json' | Out-Null");
  lines.push("} catch {");
  lines.push("    Write-Host \"Warnung: Registrierung fehlgeschlagen: $_\" -ForegroundColor Yellow");
  lines.push("}");
  lines.push("");
  lines.push("Write-Host ''");
  lines.push("Write-Host '=================================================' -ForegroundColor Green");
  lines.push("Write-Host '  Installation abgeschlossen!'                     -ForegroundColor Green");
  lines.push("Write-Host \"  RustDesk-ID: $rustdeskId\"                        -ForegroundColor Green");
  lines.push("Write-Host '  Ihr Techniker kann jetzt auf dieses Geraet zugreifen.' -ForegroundColor Green");
  lines.push("Write-Host '=================================================' -ForegroundColor Green");
  lines.push("Write-Host ''");
  lines.push("Read-Host 'Enter druecken zum Beenden'");

  return lines.join("\n");
}

function buildLinuxScript(p: {
  sessionToken: string;
  email: string;
  reportUrl: string;
  idServer: string;
  relay: string;
  key: string;
}): string {
  const lines: string[] = [];

  lines.push("#!/bin/bash");
  lines.push("# RemoteLog Fernwartungs-Setup");
  lines.push("# sudo bash remotelog-setup.sh");
  lines.push("");
  lines.push("set -e");
  lines.push("");
  lines.push(`SESSION_TOKEN="${p.sessionToken}"`);
  lines.push(`EMAIL="${p.email.replace(/"/g, '\\"')}"`);
  lines.push(`REPORT_URL="${p.reportUrl}"`);
  lines.push("");
  lines.push("echo \"\"");
  lines.push("echo \"=================================================\"");
  lines.push("echo \"  RemoteLog Fernwartungs-Setup\"");
  lines.push("echo \"=================================================\"");
  lines.push("echo \"\"");
  lines.push("");

  // Step 1: Download
  lines.push("echo \"[1/4] RustDesk wird heruntergeladen...\"");
  lines.push("ARCH=$(uname -m)");
  lines.push("case \"$ARCH\" in");
  lines.push("    x86_64)  RUSTDESK_URL=\"https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-x86_64.deb\" ;;");
  lines.push("    aarch64) RUSTDESK_URL=\"https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-aarch64.deb\" ;;");
  lines.push("    *)       echo \"Nicht unterstuetzte Architektur: $ARCH\"; exit 1 ;;");
  lines.push("esac");
  lines.push("curl -L \"$RUSTDESK_URL\" -o /tmp/rustdesk.deb");
  lines.push("");

  // Step 2: Install
  lines.push("echo \"[2/4] RustDesk wird installiert...\"");
  lines.push("if command -v dpkg &>/dev/null; then");
  lines.push("    dpkg -i /tmp/rustdesk.deb 2>/dev/null || apt-get install -f -y");
  lines.push("elif command -v rpm &>/dev/null; then");
  lines.push("    rpm -i /tmp/rustdesk.deb 2>/dev/null || true");
  lines.push("fi");
  lines.push("sleep 3");
  lines.push("");

  // Server config
  if (p.idServer) {
    lines.push("# Server-Konfiguration");
    lines.push("CONFIG_DIR=\"$HOME/.config/rustdesk\"");
    lines.push("mkdir -p \"$CONFIG_DIR\"");
    lines.push("cat > \"$CONFIG_DIR/RustDesk2.toml\" <<'EOF'");
    lines.push(`relay_server = "${p.relay}"`);
    lines.push(`id_server = "${p.idServer}"`);
    lines.push(`key = "${p.key}"`);
    lines.push("EOF");
    lines.push("");
  }

  // Step 3: Password
  lines.push("echo \"[3/4] Zugangsdaten werden gesetzt...\"");
  lines.push("PASSWORD=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 12)");
  lines.push("rustdesk --password \"$PASSWORD\" &>/dev/null || true");
  lines.push("sleep 3");
  lines.push("");

  // Step 4: Register
  lines.push("echo \"[4/4] Geraet wird registriert...\"");
  lines.push("RUSTDESK_ID=$(rustdesk --get-id 2>/dev/null | tr -d '\\n' || echo \"\")");
  lines.push("if [ -z \"$RUSTDESK_ID\" ]; then");
  lines.push("    CONFIG_FILE=\"$HOME/.config/rustdesk/RustDesk.toml\"");
  lines.push("    if [ -f \"$CONFIG_FILE\" ]; then");
  lines.push("        RUSTDESK_ID=$(grep '^id' \"$CONFIG_FILE\" | cut -d'=' -f2 | tr -d ' \"\\n')");
  lines.push("    fi");
  lines.push("fi");
  lines.push("");
  lines.push("curl -s -X POST \"$REPORT_URL\" \\");
  lines.push("    -H \"Content-Type: application/json\" \\");
  lines.push("    -d \"{\\\"sessionToken\\\":\\\"$SESSION_TOKEN\\\",\\\"email\\\":\\\"$EMAIL\\\",\\\"computerName\\\":\\\"$(hostname)\\\",\\\"rustdeskId\\\":\\\"$RUSTDESK_ID\\\",\\\"password\\\":\\\"$PASSWORD\\\"}\" \\");
  lines.push("    && echo \"Geraet registriert!\" || echo \"Warnung: Registrierung fehlgeschlagen\"");
  lines.push("");
  lines.push("echo \"\"");
  lines.push("echo \"=================================================\"");
  lines.push("echo \"  Installation abgeschlossen!\"");
  lines.push("echo \"  RustDesk-ID: $RUSTDESK_ID\"");
  lines.push("echo \"=================================================\"");

  return lines.join("\n");
}
