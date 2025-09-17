import { Home, Search, Bookmark, User, Plus, Bell } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const getNavigationItems = (user: any, notificationCount: number, newPostsCount: number) => {
  const getProfileUrl = () => {
    if (!user) return "/profile";

    // Get username from localStorage when needed
    const storedUsername = localStorage.getItem(`username_${user.id}`);
    return storedUsername ? `/profile/${storedUsername}` : "/profile";
  };

  return [
    { title: "Home", url: "/home", icon: Home, badge: newPostsCount > 0 ? newPostsCount : undefined },
    { title: "Search", url: "/search", icon: Search },
    { title: "Notifications", url: "/notifications", icon: Bell, badge: notificationCount > 0 ? notificationCount : undefined },
    { title: "Create", url: "/post", icon: Plus },
    { title: "Profile", url: getProfileUrl(), icon: User },
  ];
};

export function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;
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
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (!followsData?.length) {
        setNewPostsCount(0);
        return;
      }

      const followedUserIds = followsData.map(f => f.following_id);

      // Get last visit time from localStorage, default to 24 hours ago if not found
      const lastVisitedKey = `lastVisited_${user.id}`;
      const lastVisited = localStorage.getItem(lastVisitedKey);
      const cutoffTime = lastVisited
        ? new Date(parseInt(lastVisited))
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .in('user_id', followedUserIds)
        .gte('created_at', cutoffTime.toISOString());

      if (error) throw error;
      setNewPostsCount(count || 0);
    } catch (error) {
      console.error('Error fetching new posts count:', error);
      setNewPostsCount(0);
    }
  };

  useEffect(() => {
    fetchNotificationCount();
    fetchNewPostsCount();

    if (user) {
      const notificationSubscription = supabase
        .channel('mobile-notifications')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => {
            fetchNotificationCount();
          }
        )
        .subscribe();

      const postsSubscription = supabase
        .channel('mobile-posts')
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
  const navigationItems = getNavigationItems(user, unreadNotifications, newPostsCount);

  const renderBadge = (count: number | undefined) => {
    if (!count || count === 0) return null;

    return (
      <span className="absolute -top-1 -right-1 bg-red-500 rounded-full h-2 w-2">
      </span>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border md:hidden">
      <div className="flex items-center justify-around py-1.5 px-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            onMouseEnter={() => {
              // Preload component on hover
              if (item.url === "/home") import("@/pages/Home");
              else if (item.url === "/search") import("@/pages/Search");
              else if (item.url === "/bookmarks") import("@/pages/Bookmarks");
              else if (item.url === "/profile") import("@/pages/Profile");
              else if (item.url === "/notifications") import("@/pages/Notifications");
              else if (item.url === "/settings") import("@/pages/Settings");
              else if (item.url === "/post") import("@/pages/CreatePost");
            }}
            onClick={() => {
              if (item.url === "/notifications" && user && unreadNotifications > 0) {
                // Mark all notifications as read
                supabase
                  .from('notifications')
                  .update({ read: true })
                  .eq('user_id', user.id)
                  .eq('read', false)
                  .then(() => setUnreadNotifications(0));
              } else if (item.url === "/home" && newPostsCount > 0) {
                // Reset new posts count (user has seen them)
                setNewPostsCount(0);
                // Store in localStorage to persist across refreshes
                localStorage.setItem(`lastVisited_${user?.id}`, Date.now().toString());
              }
            }}
            className={({ isActive }) => 
              `flex flex-col items-center gap-0.5 h-auto py-1.5 px-1 relative w-full min-w-0 flex-1 rounded-md ${
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`
            }
          >
            <div className="relative">
              <item.icon className="h-4 w-4" />
              {item.badge && item.badge > 0 && renderBadge(item.badge)}
            </div>
            <span className="text-[10px] leading-tight truncate">{item.title}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}