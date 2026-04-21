import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getAddonMeta } from "@/addons/registry.server";
import { checkAddonAccess } from "@/addons/license";
import { zammadConfigSchema } from "@/addons/zammad/index";
import { invoiceNinjaConfigSchema } from "@/addons/invoiceninja/index";

function getConfigSchema(key: string) {
  if (key === "zammad") return zammadConfigSchema;
  if (key === "invoiceninja") return invoiceNinjaConfigSchema;
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key } = await params;
  const meta = getAddonMeta(key);
  if (!meta) return NextResponse.json({ error: "Addon nicht gefunden" }, { status: 404 });

  const record = await prisma.addon.findFirst({
    where: { organizationId: session.user.organizationId, key },
  });

  return NextResponse.json({
    key: meta.key,
    name: meta.name,
    description: meta.description,
    isPremium: meta.isPremium,
    enabled: record?.enabled ?? false,
    config: (record?.config as Record<string, unknown>) ?? {},
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key } = await params;
  const meta = getAddonMeta(key);
  if (!meta) return NextResponse.json({ error: "Addon nicht gefunden" }, { status: 404 });

  const body = await req.json() as { enabled?: boolean; config?: Record<string, unknown> };
  const { enabled, config } = body;

  if (enabled === undefined && config === undefined) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  // Validate config if provided
  if (config !== undefined) {
    const schema = getConfigSchema(key);
    if (schema) {
      const result = schema.safeParse(config);
      if (!result.success) {
        return NextResponse.json(
          { error: "Ungültige Konfiguration", details: result.error.issues },
          { status: 400 }
        );
      }
    }
  }

  // Premium check when enabling
  if (enabled === true && meta.isPremium) {
    const currentRecord = await prisma.addon.findFirst({
      where: { organizationId: session.user.organizationId, key },
    });
    const mergedConfig = {
      ...((currentRecord?.config as Record<string, unknown>) ?? {}),
      ...(config ?? {}),
    };
    const access = checkAddonAccess(meta.isPremium, mergedConfig);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (enabled !== undefined) updateData.enabled = enabled;
  if (config !== undefined) updateData.config = config;

  const record = await prisma.addon.upsert({
    where: {
      organizationId_key: {
        organizationId: session.user.organizationId,
        key,
      },
    },
    create: {
      organizationId: session.user.organizationId,
      key,
      enabled: enabled ?? false,
      config: (config ?? {}) as Prisma.InputJsonValue,
    },
    update: updateData,
  });

  return NextResponse.json({
    key: meta.key,
    name: meta.name,
    description: meta.description,
    isPremium: meta.isPremium,
    enabled: record.enabled,
    config: record.config as Record<string, unknown>,
  });
}
