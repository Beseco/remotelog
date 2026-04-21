import { redirect } from "next/navigation";
import { getSetupState } from "@/lib/setup";
import { prisma } from "@/lib/prisma";
import { getEffectiveSmtpConfig } from "@/lib/smtp-config";
import { SetupWizard } from "@/components/setup/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const state = await getSetupState();
  if (state.setupCompleted && state.hasAdmin) {
    redirect("/login");
  }

  const [org, smtp] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: state.organizationId },
      select: {
        name: true,
        rustdeskIdServer: true,
        rustdeskRelay: true,
        rustdeskKey: true,
      },
    }),
    getEffectiveSmtpConfig(state.organizationId),
  ]);

  return (
    <SetupWizard
      initial={{
        organizationName: org?.name ?? "Meine IT-Firma",
        smtp: {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user,
          hasPass: !!smtp.pass,
          from: smtp.from,
        },
        rustdesk: {
          rustdeskIdServer: org?.rustdeskIdServer ?? null,
          rustdeskRelay: org?.rustdeskRelay ?? null,
          rustdeskKey: org?.rustdeskKey ?? null,
        },
      }}
    />
  );
}
