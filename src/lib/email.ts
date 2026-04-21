import nodemailer from "nodemailer";
import { getEffectiveSmtpConfig } from "@/lib/smtp-config";

type TransportArg = Parameters<typeof nodemailer.createTransport>[0];

function createTransport(config: { host: string; port: number; secure: boolean; user: string | null; pass: string | null }) {
  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user ?? undefined,
      pass: config.pass ?? undefined,
    },
  };
  return nodemailer.createTransport(transportOptions as TransportArg);
}

export async function sendInstallerInvite(
  to: string,
  downloadUrl: string,
  senderName: string,
  orgName: string,
  organizationId: string,
): Promise<void> {
  const smtp = await getEffectiveSmtpConfig(organizationId);
  if (!smtp.host) {
    console.error("[email] SMTP_HOST nicht konfiguriert — Einladung nicht gesendet an", to);
    return;
  }

  const from = smtp.from;
  const transport = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
    pass: smtp.pass,
  });

  await transport.sendMail({
    from,
    to,
    subject: `${orgName} – Einrichtung der Fernwartungssoftware`,
    text: `
Hallo,

${senderName} von ${orgName} hat Sie gebeten, die Fernwartungssoftware auf Ihrem Computer einzurichten.

Was ist das?
Damit können Techniker von ${orgName} Ihnen bei technischen Problemen schnell und unkompliziert helfen - ohne vor Ort sein zu müssen.

Was müssen Sie tun?
1. Öffnen Sie folgenden Link in Ihrem Browser:
   ${downloadUrl}

2. Geben Sie Ihre E-Mail-Adresse ein und klicken Sie auf "Windows herunterladen".

3. Führen Sie die heruntergeladene Datei aus (Doppelklick) und bestätigen Sie die Sicherheitsabfrage.

Die Installation läuft dann automatisch durch.

Bei Fragen wenden Sie sich bitte an ${orgName}.

Mit freundlichen Grüßen
Ihr ${orgName}-Team
    `.trim(),
    html: `<!DOCTYPE html>
<html lang="de" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body,table,td{font-family:Arial,Helvetica,sans-serif}
  img{border:0;line-height:100%;outline:none;text-decoration:none}
  table{border-collapse:collapse!important}
  body{height:100%!important;margin:0!important;padding:0!important;width:100%!important;background-color:#f3f4f6}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6">
<tr><td align="center" style="padding:32px 16px">

  <!-- Main card -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px">
  <tr><td style="padding:40px 40px 32px 40px">

    <!-- Header -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding-bottom:24px;border-bottom:1px solid #e5e7eb">
        <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px">${orgName}</p>
        <h1 style="margin:8px 0 0 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3">Fernwartung einrichten</h1>
      </td>
    </tr>
    </table>

    <!-- Body -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr><td style="padding-top:24px">
      <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6">
        Hallo,
      </p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#374151;line-height:1.6">
        <strong>${senderName}</strong> von <strong>${orgName}</strong> hat Sie gebeten,
        die Fernwartungssoftware auf Ihrem Computer einzurichten.
      </p>
    </td></tr>

    <!-- Info box -->
    <tr><td style="padding-bottom:24px">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr><td bgcolor="#eff6ff" style="background-color:#eff6ff;border-left:4px solid #2563eb;padding:14px 16px;border-radius:0 6px 6px 0">
        <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#1e40af">Was ist das?</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.5">
          Damit können Techniker von ${orgName} Ihnen bei technischen Problemen
          schnell und unkompliziert helfen &ndash; ohne vor Ort sein zu müssen.
          Sie behalten jederzeit die Kontrolle.
        </p>
      </td></tr>
      </table>
    </td></tr>

    <!-- Steps -->
    <tr><td style="padding-bottom:8px">
      <p style="margin:0 0 14px 0;font-size:15px;font-weight:700;color:#111827">So geht's:</p>
    </td></tr>

    <tr><td style="padding-bottom:12px">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td width="32" valign="top" style="padding-top:1px">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#2563eb" style="background-color:#2563eb;border-radius:50%;width:24px;height:24px;text-align:center;vertical-align:middle">
              <span style="font-size:12px;font-weight:700;color:#ffffff;line-height:24px">1</span>
            </td>
          </tr></table>
        </td>
        <td style="padding-left:12px;font-size:14px;color:#374151;line-height:1.5">
          Klicken Sie auf den Button <strong>&bdquo;Jetzt einrichten&ldquo;</strong> weiter unten
        </td>
      </tr>
      </table>
    </td></tr>

    <tr><td style="padding-bottom:12px">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td width="32" valign="top" style="padding-top:1px">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#2563eb" style="background-color:#2563eb;border-radius:50%;width:24px;height:24px;text-align:center;vertical-align:middle">
              <span style="font-size:12px;font-weight:700;color:#ffffff;line-height:24px">2</span>
            </td>
          </tr></table>
        </td>
        <td style="padding-left:12px;font-size:14px;color:#374151;line-height:1.5">
          Geben Sie Ihre E-Mail-Adresse ein und klicken Sie auf <strong>&bdquo;Windows herunterladen&ldquo;</strong>
        </td>
      </tr>
      </table>
    </td></tr>

    <tr><td style="padding-bottom:32px">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td width="32" valign="top" style="padding-top:1px">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
            <td bgcolor="#2563eb" style="background-color:#2563eb;border-radius:50%;width:24px;height:24px;text-align:center;vertical-align:middle">
              <span style="font-size:12px;font-weight:700;color:#ffffff;line-height:24px">3</span>
            </td>
          </tr></table>
        </td>
        <td style="padding-left:12px;font-size:14px;color:#374151;line-height:1.5">
          Führen Sie die heruntergeladene Datei aus (Doppelklick) &ndash; die Installation läuft automatisch
        </td>
      </tr>
      </table>
    </td></tr>

    <!-- CTA Button (Outlook VML + normal) -->
    <tr><td align="center" style="padding-bottom:32px">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${downloadUrl}" style="height:48px;v-text-anchor:middle;width:240px" arcsize="17%"
        stroke="f" fillcolor="#2563eb">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700">
          Jetzt einrichten
        </center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${downloadUrl}"
         style="display:inline-block;background-color:#2563eb;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;mso-hide:all">
        Jetzt einrichten
      </a>
      <!--<![endif]-->
      <p style="margin:10px 0 0 0;font-size:12px;color:#9ca3af">
        Oder diesen Link im Browser öffnen:<br>
        <a href="${downloadUrl}" style="color:#6b7280;word-break:break-all">${downloadUrl}</a>
      </p>
    </td></tr>

    </table><!-- /Body -->

  </td></tr>

  <!-- Footer -->
  <tr><td bgcolor="#f9fafb" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;border-radius:0 0 12px 12px">
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
      Diese E-Mail wurde von <strong style="color:#6b7280">${orgName}</strong> über RemoteLog versendet.<br>
      Bei Fragen wenden Sie sich bitte direkt an ${orgName}.
    </p>
  </td></tr>

  </table><!-- /Main card -->

</td></tr>
</table>
</body>
</html>`,
  });
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
  organizationId: string,
): Promise<void> {
  const smtp = await getEffectiveSmtpConfig(organizationId);
  if (!smtp.host) {
    console.error("[email] SMTP_HOST ist nicht konfiguriert — E-Mail wird nicht gesendet.");
    console.error("[email] Verifikations-Token für", to, ":", token);
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify?token=${token}`;
  const from = smtp.from;

  const transport = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
    pass: smtp.pass,
  });
  await transport.sendMail({
    from,
    to,
    subject: "RemoteLog – E-Mail-Adresse bestätigen",
    text: `Hallo ${name},\n\nbitte bestätigen Sie Ihre E-Mail-Adresse:\n${verifyUrl}\n\nDer Link ist 24 Stunden gültig.\n\nIhr RemoteLog-Team`,
    html: `
      <p>Hallo ${name},</p>
      <p>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr RemoteLog-Konto zu aktivieren:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">E-Mail bestätigen</a></p>
      <p>Oder kopieren Sie diesen Link: <a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Der Link ist 24 Stunden gültig.</p>
      <p>Ihr RemoteLog-Team</p>
    `,
  });
}
