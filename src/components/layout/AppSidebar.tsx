import { Home, Search, Bookmark, User, Plus, Settings, Sun, Moon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navigationItems = [
  { title: "Home", url: "/home", icon: Home },
  { title: "Search", url: "/search", icon: Search },
  { title: "Bookmarks", url: "/bookmarks", icon: Bookmark },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Create Post", url: "/post", icon: Plus },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium" 
      : "hover:bg-accent hover:text-accent-foreground";

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"}>
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xl font-bold text-primary mb-4 px-4">
            {!collapsed && "EduHive"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Button 
                    variant="ghost" 
                    onClick={toggleTheme}
                    className="w-full justify-start"
                  >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    {!collapsed && (
                      <span className="ml-3">
                        {theme === "dark" ? "Light Mode" : "Dark Mode"}
                      </span>
                    )}
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/settings" className={getNavCls}>
                    <Settings className="h-5 w-5" />
                    {!collapsed && <span className="ml-3">Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}