"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TocSidebar } from "@/components/docs/toc-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex gap-8">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-20">
          <h3 className="font-semibold text-sm mb-3 px-2">User Guide</h3>
          <TocSidebar />
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 min-w-0 max-w-4xl">
        {/* Mobile sidebar trigger */}
        <div className="lg:hidden mb-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="h-4 w-4" />
                Documentation Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>User Guide</SheetTitle>
              </SheetHeader>
              <div className="mt-4" onClick={() => setSidebarOpen(false)}>
                <TocSidebar />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {children}
      </div>
    </div>
  );
}
