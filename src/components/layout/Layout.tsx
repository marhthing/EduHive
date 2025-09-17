import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
}

function LayoutContent({ children }: LayoutProps) {
  const { setOpenMobile } = useSidebar();
  const location = useLocation();

  // Close mobile sidebar when navigating to a new page
  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between p-3 md:p-4 border-b border-border md:hidden bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <h1 className="text-lg md:text-xl font-bold text-primary">EduHive</h1>
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}