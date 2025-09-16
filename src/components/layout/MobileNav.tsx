import { Home, Search, Bookmark, User, Plus } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const navigationItems = [
  { title: "Home", url: "/home", icon: Home },
  { title: "Search", url: "/search", icon: Search },
  { title: "Create", url: "/post", icon: Plus },
  { title: "Bookmarks", url: "/bookmarks", icon: Bookmark },
  { title: "Profile", url: "/profile", icon: User },
];

export function MobileNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around py-2">
        {navigationItems.map((item) => (
          <NavLink key={item.title} to={item.url}>
            <Button
              variant={isActive(item.url) ? "default" : "ghost"}
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.title}</span>
            </Button>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}