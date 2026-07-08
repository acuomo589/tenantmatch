"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/workspace/app-sidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className={sidebarCollapsed ? "w-[88px]" : "w-[304px]"}>
          <div className="flex h-screen flex-col border-r border-border bg-sidebar">
            <div className="flex justify-end px-3 pt-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
              >
                <ChevronLeft className={`size-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <AppSidebar collapsed={sidebarCollapsed} pathname={pathname} />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="grid">
              <span className="text-sm font-semibold tracking-tight">TenantMatch</span>
              <span className="text-xs text-muted-foreground">Buyer link admin</span>
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <PanelLeft className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[86vw] max-w-[22rem] p-0" side="left">
                <SheetHeader className="sr-only">
                  <SheetTitle>Workspace navigation</SheetTitle>
                </SheetHeader>
                <AppSidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <section className="min-h-screen">
          <div className="container py-5 md:py-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
