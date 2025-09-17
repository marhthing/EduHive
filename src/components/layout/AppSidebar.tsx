import { Home, Search, Bookmark, User, Plus, Settings, Sun, Moon, LogOut, Bell } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Link } from "react-router-dom";


const getNavigationItems = (username: string, unreadNotifications: number, newPostsCount: number, handleNavClick: (url: string) => void) => [
  { title: "Home", url: "/home", icon: Home, badge: newPostsCount, onClick: () => handleNavClick("/home") },
  { title: "Search", url: "/search", icon: Search, onClick: () => handleNavClick("/search") },
  { title: "Notifications", url: "/notifications", icon: Bell, badge: unreadNotifications, onClick: () => handleNavClick("/notifications") },
  { title: "Bookmarks", url: "/bookmarks", icon: Bookmark, onClick: () => handleNavClick("/bookmarks") },
  { title: "Profile", url: `/profile/${username}`, icon: User, onClick: () => handleNavClick(`/profile/${username}`) },
  { title: "Create Post", url: "/post", icon: Plus, onClick: () => handleNavClick("/post") },
];

  const renderBadge = (count: number) => {
    if (count === 0) return null;
    
    return (
      <span className="absolute -top-1 -right-1 bg-red-500 rounded-full h-2 w-2">
      </span>
    );
  };

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [username, setUsername] = useState<string>("");
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [newPostsCount, setNewPostsCount] = useState<number>(0);

  const fetchNotificationCount = async () => {
    if (!user) return;
    
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadNotifications(count || 0);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const fetchNewPostsCount = async () => {
    if (!user) return;

    try {
      // Get posts from last 24 hours from followed users
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (!followsData?.length) return;

      const followedUserIds = followsData.map(f => f.following_id);
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .in('user_id', followedUserIds)
        .gte('created_at', yesterday.toISOString());

      if (error) throw error;
      setNewPostsCount(count || 0);
    } catch (error) {
      console.error('Error fetching new posts count:', error);
    }
  };

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
    fetchNotificationCount();
    fetchNewPostsCount();

    // Set up real-time listeners
    if (user) {
      const notificationSubscription = supabase
        .channel('notifications')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => {
            fetchNotificationCount();
          }
        )
        .subscribe();

      const postsSubscription = supabase
        .channel('posts')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'posts' },
          () => {
            fetchNewPostsCount();
          }
        )
        .subscribe();

      return () => {
        notificationSubscription.unsubscribe();
        postsSubscription.unsubscribe();
      };
    }
  }, [user]);

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium" 
      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  const handleSignOut = async () => {
    try {
      await signOut();
      // Removed success notification - Twitter-style minimalism
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      showToast("Failed to sign out. Please try again.", "error");
    }
  };

  const handleNavClick = async (url: string) => {
    if (url === "/notifications" && user && unreadNotifications > 0) {
      // Mark all notifications as read
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false);
        setUnreadNotifications(0);
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    } else if (url === "/home" && newPostsCount > 0) {
      // Reset new posts count (user has seen them)
      setNewPostsCount(0);
    }
  };

  const navigationItems = getNavigationItems(username, unreadNotifications, newPostsCount, handleNavClick);

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
                    <NavLink to={item.url} end className={getNavCls} onClick={item.onClick}>
                      <div className="relative">
                        <item.icon className="h-5 w-5" />
                        {item.badge && item.badge > 0 && renderBadge(item.badge)}
                      </div>
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Button 
                    variant="ghost" 
                    onClick={handleSignOut}
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-5 w-5" />
                    {!collapsed && <span className="ml-3">Sign Out</span>}
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}