import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupState } from "@/lib/setup";
import { getEffectiveSmtpConfig } from "@/lib/smtp-config";

export async function GET() {
  const state = await getSetupState();
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

  return NextResponse.json({
    isSetupOpen: !state.setupCompleted || !state.hasAdmin,
    hasAdmin: state.hasAdmin,
    setupCompleted: state.setupCompleted,
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
  });
}
