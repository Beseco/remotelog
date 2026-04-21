"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Clock,
  FolderTree,
  Settings,
  ShieldCheck,
  ChevronRight,
  MonitorDot,
  BarChart2,
  Building2,
  Search,
  ExternalLink,
  FolderOpen,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Group = {
  id: string;
  name: string;
  parentId: string | null;
  organizationId: string;
  sortOrder: number;
};

type User = {
  name?: string | null;
  email?: string | null;
  role?: string;
};

const baseNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Schnellsuche", icon: Search },
  { href: "/customers", label: "Kunden", icon: Building2 },
  { href: "/projects", label: "Projekte", icon: FolderOpen },
  { href: "/devices", label: "Geräte", icon: Monitor },
  { href: "/sessions", label: "Sitzungen", icon: Clock },
  { href: "/reports", label: "Berichte", icon: BarChart2 },
] as const;

const groupNavItem = { href: "/groups", label: "Gruppen", icon: FolderTree } as const;

function buildTree(groups: Group[], parentId: string | null = null): Group[] {
  return groups
    .filter((g) => g.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function GroupTree({
  groups,
  allGroups,
  depth = 0,
}: {
  groups: Group[];
  allGroups: Group[];
  depth?: number;
}) {
  const pathname = usePathname();

  return (
    <>
      {groups.map((group) => {
        const children = buildTree(allGroups, group.id);
        const isActive = pathname === `/groups/${group.id}`;

        if (children.length > 0) {
          return (
            <Collapsible key={group.id} defaultOpen={depth === 0}>
              <SidebarMenuSubItem>
                <CollapsibleTrigger
                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  data-active={isActive || undefined}
                >
                  <Link
                    href={`/groups/${group.id}`}
                    className="flex-1 text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {group.name}
                  </Link>
                  <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <GroupTree groups={children} allGroups={allGroups} depth={depth + 1} />
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuSubItem>
            </Collapsible>
          );
        }

        return (
          <SidebarMenuSubItem key={group.id}>
            <SidebarMenuSubButton
              render={<Link href={`/groups/${group.id}`} />}
              isActive={isActive}
            >
              {group.name}
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </>
  );
}

type ExternalLink = { key: string; label: string; url: string };

export function AppSidebar({
  groups,
  user,
  externalLinks = [],
}: {
  groups: Group[];
  user: User;
  externalLinks?: ExternalLink[];
}) {
  const pathname = usePathname();
  const rootGroups = buildTree(groups, null);

  // Show Groups nav item only when groups exist (or when already on a groups page)
  const navItems = [
    ...baseNavItems,
    ...(groups.length > 0 || pathname.startsWith("/groups")
      ? [groupNavItem]
      : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MonitorDot className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">RemoteLog</span>
                <span className="truncate text-xs text-muted-foreground capitalize">
                  {user.role}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)
                  }
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* External integrations */}
        {externalLinks.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Integrationen</SidebarGroupLabel>
            <SidebarMenu>
              {externalLinks.map((link) => (
                <SidebarMenuItem key={link.key}>
                  <SidebarMenuButton
                    render={<a href={link.url} target="_blank" rel="noopener noreferrer" />}
                    tooltip={link.label}
                  >
                    <ExternalLink />
                    <span>{link.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Groups tree */}
        {rootGroups.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Gruppen</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <GroupTree groups={rootGroups} allGroups={groups} />
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname === "/settings"}
              tooltip="Einstellungen"
            >
              <Settings />
              <span>Einstellungen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user.role === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/settings/admin" />}
                isActive={pathname.startsWith("/settings/admin")}
                tooltip="Admin-Einstellungen"
              >
                <ShieldCheck />
                <span>Administration</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {user.role === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/contacts/duplicates" />}
                isActive={pathname.startsWith("/contacts/duplicates")}
                tooltip="Doppelte Ansprechpartner"
              >
                <Users />
                <span>Duplikate bereinigen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        <div className="px-2 pb-1">
          <SidebarTrigger className="w-full justify-start" />
        </div>
        <div className="px-3 pb-2">
          <span className="text-[10px] text-muted-foreground/50 font-mono select-none">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
