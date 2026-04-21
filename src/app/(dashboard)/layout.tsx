import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { TimerProvider } from "@/lib/timer-context";
import { SessionReminder } from "@/components/layout/session-reminder";
import { PendingDevicesNotification } from "@/components/install/PendingDevicesNotification";
import { setupIsOpen } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await setupIsOpen()) redirect("/setup");

  const session = await auth();
  if (!session?.user) redirect("/login");

  const [groups, addons, customers] = await Promise.all([
    prisma.group.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.addon.findMany({
      where: { organizationId: session.user.organizationId, enabled: true },
      select: { key: true, config: true },
    }),
    prisma.customer.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const externalLinks: { key: string; label: string; url: string }[] = [];
  for (const addon of addons) {
    const config = addon.config as Record<string, unknown>;
    if (addon.key === "zammad" && typeof config.zammadUrl === "string") {
      externalLinks.push({ key: "zammad", label: "Zammad", url: config.zammadUrl });
    }
    if (addon.key === "invoiceninja" && typeof config.invoiceNinjaUrl === "string") {
      externalLinks.push({ key: "invoiceninja", label: "Invoice Ninja", url: config.invoiceNinjaUrl });
    }
  }

  return (
    <TimerProvider>
      <SessionReminder />
      <SidebarProvider>
        <AppSidebar groups={groups} user={session.user} externalLinks={externalLinks} />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar user={session.user} />
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        </div>
        <PendingDevicesNotification customers={customers} />
      </SidebarProvider>
    </TimerProvider>
  );
}
