import { Home, Search, Bookmark, User, Plus } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

const getNavigationItems = (username: string) => [
  { title: "Home", url: "/home", icon: Home },
  { title: "Search", url: "/search", icon: Search },
  { title: "Create", url: "/post", icon: Plus },
  { title: "Bookmarks", url: "/bookmarks", icon: Bookmark },
  { title: "Profile", url: `/profile/${username}`, icon: User },
];

export function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const { data, error } = await import("@/integrations/supabase/client").then(module => 
            module.supabase.from("profiles").select("username").eq("user_id", user.id).single()
          );
          if (error) throw error;
          setUsername(data?.username || "");
        } catch (error) {
          console.error("Error fetching username:", error);
          setUsername("");
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  const isActive = (path: string) => currentPath === path;
  const navigationItems = getNavigationItems(username);

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