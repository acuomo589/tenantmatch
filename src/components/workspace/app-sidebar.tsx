"use client";

import Link from "next/link";
import { Building2, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function AppSidebar({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed?: boolean;
  pathname: string;
  usageSnapshot?: unknown;
  onNavigate?: () => void;
}) {
  const listingsActive = pathname === "/workspace";

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", collapsed ? "px-3 py-4" : "px-4 py-5")}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-accent text-sidebar-accent-foreground">
          <Sparkles className="size-4" />
        </div>
        {!collapsed ? (
          <div className="grid gap-0.5">
            <span className="text-base font-semibold tracking-tight">TenantMatch</span>
            <span className="text-xs text-sidebar-foreground/70">Sheet-driven buyer links</span>
          </div>
        ) : null}
      </div>

      <Separator className="my-5 bg-sidebar-border" />

      <nav className="grid gap-1.5">
        <SidebarLink href="/workspace" active={listingsActive} collapsed={collapsed} icon={<Building2 className="size-4" />} onClick={onNavigate}>
          Admin
        </SidebarLink>
      </nav>

      <div className="mt-6 flex-1">
        <div />
      </div>

      {!collapsed ? (
        <div className="rounded-[1.5rem] border border-sidebar-border bg-sidebar-accent/30 p-4 text-sm text-sidebar-foreground/80">
          Add buyer rows to a Google Sheet, process new rows from admin, and track who opened and paid for each workbook link.
        </div>
      ) : null}
    </div>
  );
}

function SidebarLink({
  href,
  active,
  collapsed,
  icon,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  collapsed?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <span>{icon}</span>
      {!collapsed ? <span>{children}</span> : null}
    </Link>
  );
}

export { AppSidebar };
