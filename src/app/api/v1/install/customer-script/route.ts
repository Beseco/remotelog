import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  const { searchParams } = req.nextUrl;
  const customerId = searchParams.get("customerId");
  const mode = searchParams.get("mode") === "approval" ? "approval" : "unattended";
  const os = searchParams.get("os") === "linux" ? "linux" : "windows";

  if (!customerId) {
    return NextResponse.json({ error: "customerId fehlt" }, { status: 400 });
  }

  const [org, customer] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { registrationToken: true, appUrl: true },
    }),
    prisma.customer.findFirst({
      where: { id: customerId, organizationId: session.user.organizationId },
      select: { name: true },
    }),
  ]);

  if (!org?.registrationToken) {
    return NextResponse.json({ error: "Kein Installations-Token konfiguriert. Bitte zuerst unter Einstellungen → Installer-Link generieren." }, { status: 400 });
  }
  if (!customer) {
    return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  }

  const baseUrl = (org.appUrl ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const reportUrl = `${baseUrl}/api/v1/install/report`;

  const filename = os === "linux"
    ? `remotelog-${customer.name.replace(/[^a-zA-Z0-9]/g, "-")}-setup.sh`
    : `remotelog-${customer.name.replace(/[^a-zA-Z0-9]/g, "-")}-setup.cmd`;

  if (os === "linux") {
    const script = buildLinuxScript({ orgToken: org.registrationToken, customerId, mode, reportUrl });
    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const script = buildWindowsCmd({ orgToken: org.registrationToken, customerId, mode, reportUrl });
  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function buildWindowsCmd(p: { orgToken: string; customerId: string; mode: string; reportUrl: string }): string {
  const L: string[] = [];
  const isApproval = p.mode === "approval";

  L.push("@echo off");
  L.push("setlocal enabledelayedexpansion");
  L.push("");
  L.push(":: Pruefen ob Administrator");
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
  L.push(`set ORG_TOKEN=${p.orgToken}`);
  L.push(`set CUSTOMER_ID=${p.customerId}`);
  L.push(`set MODE=${p.mode}`);
  L.push(`set REPORT_URL=${p.reportUrl}`);
  L.push("");
  L.push("echo.");
  L.push("echo =================================================");
  L.push(`echo   RemoteLog Fernwartungs-Setup (${isApproval ? "Mit Genehmigung" : "Unbeaufsichtigt"})`);
  L.push("echo =================================================");
  L.push("echo.");
  L.push("");

  L.push("echo [1/4] RustDesk wird heruntergeladen...");
  L.push(`curl -L --progress-bar -o "%TEMP%\\rustdesk-installer.exe" "https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-x86_64.exe"`);
  L.push("if errorlevel 1 ( echo Fehler beim Download. & pause & exit /b 1 )");
  L.push("");

  L.push("echo [2/4] RustDesk wird installiert...");
  L.push(`start /wait "" "%TEMP%\\rustdesk-installer.exe" --silent-install`);
  L.push("timeout /t 5 /nobreak >nul");
  L.push("");
  L.push("set RUSTDESK_EXE=");
  L.push(`if exist "%ProgramFiles%\\RustDesk\\rustdesk.exe" set "RUSTDESK_EXE=%ProgramFiles%\\RustDesk\\rustdesk.exe"`);
  L.push(`if exist "%ProgramFiles(x86)%\\RustDesk\\rustdesk.exe" set "RUSTDESK_EXE=%ProgramFiles(x86)%\\RustDesk\\rustdesk.exe"`);
  L.push("if not defined RUSTDESK_EXE ( echo RustDesk nicht gefunden. & pause & exit /b 1 )");
  L.push("");

  L.push("echo [3/4] RustDesk wird konfiguriert...");
  if (isApproval) {
    L.push(":: Genehmigungsmodus: kein Passwort, Nutzer muss Verbindung bestaetigen");
    L.push(`if not exist "%APPDATA%\\RustDesk\\config" mkdir "%APPDATA%\\RustDesk\\config"`);
    L.push(`(echo approve_mode = "click") >> "%APPDATA%\\RustDesk\\config\\RustDesk2.toml"`);
  } else {
    L.push("set PASSWORD=%RANDOM%%RANDOM%%RANDOM%");
    L.push(`"%RUSTDESK_EXE%" --password %PASSWORD% >nul 2>&1`);
  }
  L.push("timeout /t 3 /nobreak >nul");
  L.push("");

  L.push("echo [4/4] Geraet wird registriert...");
  L.push(`for /f "tokens=* usebackq" %%i in (\`"%RUSTDESK_EXE%" --get-id 2^>nul\`) do set RUSTDESK_ID=%%i`);
  L.push("if not defined RUSTDESK_ID (");
  L.push(`    for /f "tokens=2 delims==" %%i in ('findstr /b "id " "%APPDATA%\\RustDesk\\config\\RustDesk.toml" 2^>nul') do set RUSTDESK_ID=%%i`);
  L.push("    set RUSTDESK_ID=!RUSTDESK_ID: =!");
  L.push(`    set RUSTDESK_ID=!RUSTDESK_ID:"=!`);
  L.push(")");
  L.push("");
  L.push("set JSON_FILE=%TEMP%\\rl-report.json");
  if (isApproval) {
    L.push(`(echo {"orgToken":"%ORG_TOKEN%","customerId":"%CUSTOMER_ID%","mode":"approval","computerName":"%COMPUTERNAME%","rustdeskId":"%RUSTDESK_ID%","password":""}) > "%JSON_FILE%"`);
  } else {
    L.push(`(echo {"orgToken":"%ORG_TOKEN%","customerId":"%CUSTOMER_ID%","mode":"unattended","computerName":"%COMPUTERNAME%","rustdeskId":"%RUSTDESK_ID%","password":"%PASSWORD%"}) > "%JSON_FILE%"`);
  }
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

function buildLinuxScript(p: { orgToken: string; customerId: string; mode: string; reportUrl: string }): string {
  const isApproval = p.mode === "approval";
  const L: string[] = [];

  L.push("#!/bin/bash");
  L.push(`# RemoteLog Installer (${isApproval ? "Mit Genehmigung" : "Unbeaufsichtigt"})`);
  L.push("# sudo bash " + "remotelog-setup.sh");
  L.push("");
  L.push("set -e");
  L.push(`ORG_TOKEN="${p.orgToken}"`);
  L.push(`CUSTOMER_ID="${p.customerId}"`);
  L.push(`MODE="${p.mode}"`);
  L.push(`REPORT_URL="${p.reportUrl}"`);
  L.push("");
  L.push("echo '================================================='");
  L.push(`echo '  RemoteLog Setup (${isApproval ? "Mit Genehmigung" : "Unbeaufsichtigt"})'`);
  L.push("echo '================================================='");
  L.push("");
  L.push("echo '[1/4] RustDesk herunterladen...'");
  L.push("ARCH=$(uname -m)");
  L.push("case \"$ARCH\" in");
  L.push("    x86_64)  URL='https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-x86_64.deb' ;;");
  L.push("    aarch64) URL='https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-aarch64.deb' ;;");
  L.push("    *) echo \"Nicht unterstuetzte Architektur: $ARCH\"; exit 1 ;;");
  L.push("esac");
  L.push("curl -L \"$URL\" -o /tmp/rustdesk.deb");
  L.push("");
  L.push("echo '[2/4] RustDesk installieren...'");
  L.push("dpkg -i /tmp/rustdesk.deb 2>/dev/null || apt-get install -f -y");
  L.push("sleep 3");
  L.push("");
  L.push("echo '[3/4] Konfigurieren...'");
  if (isApproval) {
    L.push("mkdir -p \"$HOME/.config/rustdesk\"");
    L.push("echo 'approve_mode = \"click\"' >> \"$HOME/.config/rustdesk/RustDesk2.toml\"");
    L.push("PASSWORD=''");
  } else {
    L.push("PASSWORD=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 12)");
    L.push("rustdesk --password \"$PASSWORD\" &>/dev/null || true");
    L.push("sleep 3");
  }
  L.push("");
  L.push("echo '[4/4] Registrieren...'");
  L.push("RUSTDESK_ID=$(rustdesk --get-id 2>/dev/null | tr -d '\\n' || echo '')");
  L.push("curl -s -X POST \"$REPORT_URL\" \\");
  L.push("    -H 'Content-Type: application/json' \\");
  L.push("    -d \"{\\\"orgToken\\\":\\\"$ORG_TOKEN\\\",\\\"customerId\\\":\\\"$CUSTOMER_ID\\\",\\\"mode\\\":\\\"$MODE\\\",\\\"computerName\\\":\\\"$(hostname)\\\",\\\"rustdeskId\\\":\\\"$RUSTDESK_ID\\\",\\\"password\\\":\\\"$PASSWORD\\\"}\"");
  L.push("");
  L.push("echo '================================================='");
  L.push("echo '  Fertig! RustDesk-ID: '\"$RUSTDESK_ID\"");
  L.push("echo '================================================='");

  return L.join("\n");
}
