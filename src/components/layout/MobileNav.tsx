import { Home, Search, Bookmark, User, Plus, Bell } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const getNavigationItems = (username: string, notificationCount: number, newPostsCount: number, handleNavClick: (url: string) => void) => [
  { title: "Home", url: "/home", icon: Home, badge: newPostsCount > 0 ? newPostsCount : undefined, onClick: () => handleNavClick("/home") },
  { title: "Search", url: "/search", icon: Search, onClick: () => handleNavClick("/search") },
  { title: "Notifications", url: "/notifications", icon: Bell, badge: notificationCount > 0 ? notificationCount : undefined, onClick: () => handleNavClick("/notifications") },
  { title: "Create", url: "/post", icon: Plus, onClick: () => handleNavClick("/post") },
  { title: "Profile", url: username ? `/profile/${username}` : "/profile", icon: User, onClick: () => handleNavClick(username ? `/profile/${username}` : "/profile") },
];

export function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [newPostsCount, setNewPostsCount] = useState<number>(0);

  // Get username from user metadata
  const username = user?.user_metadata?.username || "";

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
      // Store in localStorage to persist across refreshes
      localStorage.setItem(`lastVisited_${user?.id}`, Date.now().toString());
    }
  };

  const isActive = (path: string) => currentPath === path;
  const navigationItems = getNavigationItems(username, unreadNotifications, newPostsCount, handleNavClick);

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
          <NavLink key={item.title} to={item.url} onClick={item.onClick} className="flex-1">
            <Button
              variant={isActive(item.url) ? "default" : "ghost"}
              size="sm"
              className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-1 relative w-full min-w-0"
            >
              <div className="relative">
                <item.icon className="h-4 w-4" />
                {item.badge && item.badge > 0 && renderBadge(item.badge)}
              </div>
              <span className="text-[10px] leading-tight truncate">{item.title}</span>
            </Button>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}