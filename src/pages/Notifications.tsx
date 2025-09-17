
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, UserPlus, Bell, BellOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'reply';
  message: string;
  read: boolean;
  created_at: string;
  post_id: string | null;
  comment_id: string | null;
  from_user: {
    username: string;
    name: string | null;
    profile_pic: string | null;
  };
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const { showToast } = useTwitterToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      console.log('Fetching notifications for user:', user.id);
      
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          message,
          read,
          created_at,
          post_id,
          comment_id,
          from_user_id
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Notifications query result:', { data, error });

      if (error) throw error;

      // Fetch user profiles separately
      const notificationsWithProfiles = await Promise.all(
        (data || []).map(async (notification) => {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('username, name, profile_pic')
              .eq('user_id', notification.from_user_id)
              .single();

            if (profileError) {
              console.error('Error fetching profile for notification:', profileError);
            }

            return {
              ...notification,
              from_user: profileData || {
                username: 'Unknown',
                name: null,
                profile_pic: null
              }
            };
          } catch (profileFetchError) {
            console.error('Error in profile fetch:', profileFetchError);
            return {
              ...notification,
              from_user: {
                username: 'Unknown',
                name: null,
                profile_pic: null
              }
            };
          }
        })
      );

      console.log('Final notifications with profiles:', notificationsWithProfiles);
      setNotifications(notificationsWithProfiles);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      showToast("Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    setMarkingAllRead(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(notifications.map(n => ({ ...n, read: true })));
      showToast("All notifications marked as read", "success");
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      showToast("Failed to mark all as read", "error");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'follow') {
      navigate(`/profile/${notification.from_user.username}`);
    } else if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-5 w-5 text-red-500" />;
      case 'comment':
      case 'reply':
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs">
                  {unreadCount}
                </span>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={markingAllRead}
              >
                {markingAllRead ? "Marking..." : "Mark all as read"}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <BellOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
              <p className="text-muted-foreground">
                When someone likes, comments, or follows you, you'll see it here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-muted/30' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={notification.from_user.profile_pic || undefined} />
                      <AvatarFallback>
                        {notification.from_user.username[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-foreground mb-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getNotificationIcon(notification.type)}
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
