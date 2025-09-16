import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Desktop Sidebar */}
        <AppSidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Mobile Header */}
          <header className="flex items-center justify-between p-4 border-b border-border md:hidden">
            <h1 className="text-xl font-bold text-primary">EduHive</h1>
            <SidebarTrigger />
          </header>

          {/* Page Content */}
          <div className="flex-1 pb-16 md:pb-0">
            {children}
          </div>
        </main>

        {/* Mobile Navigation */}
        <MobileNav />
      </div>
    </SidebarProvider>
  );
}