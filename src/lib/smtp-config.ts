import { prisma } from "@/lib/prisma";

export type SmtpConfig = {
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
};

export async function getEffectiveSmtpConfig(organizationId: string): Promise<SmtpConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPass: true,
      smtpFrom: true,
    },
  });

  return {
    host: org?.smtpHost ?? process.env.SMTP_HOST ?? null,
    port: org?.smtpPort ?? Number(process.env.SMTP_PORT ?? 587),
    secure: org?.smtpSecure ?? (process.env.SMTP_SECURE === "true"),
    user: org?.smtpUser ?? process.env.SMTP_USER ?? null,
    pass: org?.smtpPass ?? process.env.SMTP_PASS ?? null,
    from: org?.smtpFrom ?? process.env.SMTP_FROM ?? "noreply@remotelog.de",
  };
}
