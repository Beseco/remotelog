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
    select: { rustdeskIdServer: true, rustdeskRelay: true, rustdeskKey: true, appUrl: true },
  });
  return { org, email: reg.email ?? "" };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionToken = searchParams.get("s")?.toUpperCase();
  const os = searchParams.get("os") === "linux" ? "linux" : "windows";
  const mode = searchParams.get("mode") === "approval" ? "approval" : "unattended";

  if (!sessionToken || !/^[A-Z0-9]{8}$/.test(sessionToken)) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 400 });
  }

  const result = await loadOrgBySession(sessionToken);
  if (!result) {
    return NextResponse.json({ error: "Token nicht gefunden" }, { status: 404 });
  }

  const { org, email } = result;
  const baseUrl = (org?.appUrl ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const reportUrl = `${baseUrl}/api/v1/install/report`;

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
    mode,
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
  mode: string;
}): string {
  const isApproval = p.mode === "approval";
  const L: string[] = [];

  L.push("@echo off");
  L.push("setlocal enabledelayedexpansion");
  L.push("");
  // Check admin — show clear error instead of silent re-launch
  L.push("net session >nul 2>&1");
  L.push("if errorlevel 1 (");
  L.push("    echo.");
  L.push("    echo FEHLER: Dieses Skript muss als Administrator ausgefuehrt werden.");
  L.push("    echo Rechtsklick auf die Datei und 'Als Administrator ausfuehren' waehlen.");
  L.push("    echo.");
  L.push("    pause");
  L.push("    exit /b 1");
  L.push(")");
  L.push("");
  L.push(`set SESSION_TOKEN=${p.sessionToken}`);
  L.push(`set EMAIL=${p.email}`);
  L.push(`set REPORT_URL=${p.reportUrl}`);
  if (p.idServer) {
    L.push(`set ID_SERVER=${p.idServer}`);
    L.push(`set RELAY_SERVER=${p.relay}`);
    L.push(`set RUSTDESK_KEY=${p.key}`);
  }
  L.push("");
  L.push("echo.");
  L.push("echo =================================================");
  L.push(`echo   RemoteLog Fernwartungs-Setup (${isApproval ? "Mit Genehmigung" : "Unbeaufsichtigt"})`);
  L.push("echo =================================================");
  L.push("echo.");
  L.push("");

  // Step 1: Download
  L.push("echo [1/4] RustDesk wird heruntergeladen...");
  L.push(`curl -L --progress-bar -o "%TEMP%\\rustdesk-installer.exe" "https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-x86_64.exe"`);
  L.push("if errorlevel 1 ( echo Fehler beim Download. & pause & exit /b 1 )");
  L.push("");

  // Step 2: Install
  L.push("echo [2/4] RustDesk wird installiert...");
  L.push(`start /wait "" "%TEMP%\\rustdesk-installer.exe" --silent-install`);
  L.push("timeout /t 5 /nobreak >nul");
  L.push("");
  L.push("set RUSTDESK_EXE=");
  L.push(`if exist "%ProgramFiles%\\RustDesk\\rustdesk.exe" set "RUSTDESK_EXE=%ProgramFiles%\\RustDesk\\rustdesk.exe"`);
  L.push(`if exist "%ProgramFiles(x86)%\\RustDesk\\rustdesk.exe" set "RUSTDESK_EXE=%ProgramFiles(x86)%\\RustDesk\\rustdesk.exe"`);
  L.push("if not defined RUSTDESK_EXE ( echo RustDesk nicht gefunden. & pause & exit /b 1 )");
  L.push("");

  // Server config (only if configured)
  if (p.idServer) {
    L.push(`if not exist "%APPDATA%\\RustDesk\\config" mkdir "%APPDATA%\\RustDesk\\config"`);
    L.push(`(`);
    L.push(`    echo relay_server = "%RELAY_SERVER%"`);
    L.push(`    echo id_server = "%ID_SERVER%"`);
    L.push(`    echo key = "%RUSTDESK_KEY%"`);
    L.push(`) > "%APPDATA%\\RustDesk\\config\\RustDesk2.toml"`);
    L.push("");
  }

  // Step 3: Password or approval mode
  L.push("echo [3/4] RustDesk wird konfiguriert...");
  if (isApproval) {
    L.push(":: Genehmigungsmodus: kein Passwort, Nutzer muss jede Verbindung bestaetigen");
    L.push(`if not exist "%APPDATA%\\RustDesk\\config" mkdir "%APPDATA%\\RustDesk\\config"`);
    L.push(`(echo approve_mode = "click") >> "%APPDATA%\\RustDesk\\config\\RustDesk2.toml"`);
    L.push("set PASSWORD=");
  } else {
    L.push("set PASSWORD=%RANDOM%%RANDOM%%RANDOM%");
    L.push(`"%RUSTDESK_EXE%" --password %PASSWORD% >nul 2>&1`);
  }
  L.push("timeout /t 3 /nobreak >nul");
  L.push("");

  // Step 4: Get ID and register
  L.push("echo [4/4] Geraet wird registriert...");
  L.push(`for /f "tokens=* usebackq" %%i in (\`"%RUSTDESK_EXE%" --get-id 2^>nul\`) do set RUSTDESK_ID=%%i`);
  L.push("if not defined RUSTDESK_ID (");
  L.push(`    for /f "tokens=2 delims==" %%i in ('findstr /b "id " "%APPDATA%\\RustDesk\\config\\RustDesk.toml" 2^>nul') do set RUSTDESK_ID=%%i`);
  L.push("    set RUSTDESK_ID=!RUSTDESK_ID: =!");
  L.push(`    set RUSTDESK_ID=!RUSTDESK_ID:"=!`);
  L.push(")");
  L.push("");
  // Write JSON to temp file to avoid CMD quote-escaping issues with curl -d
  L.push("set JSON_FILE=%TEMP%\\rl-report.json");
  L.push(`(echo {"sessionToken":"%SESSION_TOKEN%","email":"%EMAIL%","computerName":"%COMPUTERNAME%","rustdeskId":"%RUSTDESK_ID%","password":"%PASSWORD%"}) > "%JSON_FILE%"`);
  L.push(`curl -s -X POST "%REPORT_URL%" -H "Content-Type: application/json" -d "@%JSON_FILE%"`);
  L.push(`del "%JSON_FILE%" 2>nul`);
  L.push("");
  L.push("echo.");
  L.push("echo =================================================");
  L.push("echo   Installation abgeschlossen^!");
  L.push("echo   RustDesk-ID: %RUSTDESK_ID%");
  if (isApproval) {
    L.push("echo   Ihr Techniker muss jede Verbindung von Ihnen bestaetigen lassen.");
  } else {
    L.push("echo   Ihr Techniker kann sich jetzt jederzeit verbinden.");
  }
  L.push("echo =================================================");
  L.push("echo.");
  L.push("pause");

  return L.join("\r\n");
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
