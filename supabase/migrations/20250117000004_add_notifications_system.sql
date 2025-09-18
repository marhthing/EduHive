
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'reply', 'mention')),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);

-- RLS policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications" ON notifications
FOR INSERT WITH CHECK (true);

-- Ensure profiles are readable for notification purposes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);
  END IF;
END $$;

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_from_user_id UUID,
  p_type TEXT,
  p_message TEXT,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Don't create notification if user is notifying themselves
  IF p_user_id = p_from_user_id THEN
    RETURN;
  END IF;
  
  -- Insert the notification
  INSERT INTO notifications (user_id, from_user_id, type, message, post_id, comment_id)
  VALUES (p_user_id, p_from_user_id, p_type, p_message, p_post_id, p_comment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create mention notifications
CREATE OR REPLACE FUNCTION create_mention_notifications(
  p_mentioned_usernames TEXT[],
  p_from_user_id UUID,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  mentioned_user_id UUID;
  from_username TEXT;
  username TEXT;
  notification_message TEXT;
BEGIN
  -- Get the username of the person doing the mentioning
  SELECT username INTO from_username FROM profiles WHERE user_id = p_from_user_id;
  
  -- Loop through each mentioned username
  FOREACH username IN ARRAY p_mentioned_usernames
  LOOP
    -- Skip AI bot mentions
    IF username = 'eduhive' THEN
      CONTINUE;
    END IF;
    
    -- Find the user ID for this username
    SELECT user_id INTO mentioned_user_id 
    FROM profiles 
    WHERE username = username;
    
    -- If user exists, create notification
    IF mentioned_user_id IS NOT NULL THEN
      -- Create appropriate message based on context
      IF p_comment_id IS NOT NULL THEN
        notification_message := from_username || ' mentioned you in a comment';
      ELSE
        notification_message := from_username || ' mentioned you in a post';
      END IF;
      
      -- Create the notification
      PERFORM create_notification(
        mentioned_user_id,
        p_from_user_id,
        'mention',
        notification_message,
        p_post_id,
        p_comment_id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for like notifications
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  liker_username TEXT;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Get liker username
  SELECT username INTO liker_username FROM profiles WHERE user_id = NEW.user_id;
  
  -- Create notification
  PERFORM create_notification(
    post_owner_id,
    NEW.user_id,
    'like',
    liker_username || ' liked your post',
    NEW.post_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for comment notifications
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  commenter_username TEXT;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Get commenter username
  SELECT username INTO commenter_username FROM profiles WHERE user_id = NEW.user_id;
  
  -- Create notification
  PERFORM create_notification(
    post_owner_id,
    NEW.user_id,
    'comment',
    commenter_username || ' commented on your post',
    NEW.post_id,
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for follow notifications
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER AS $$
DECLARE
  follower_username TEXT;
BEGIN
  -- Get follower username
  SELECT username INTO follower_username FROM profiles WHERE user_id = NEW.follower_id;
  
  -- Create notification
  PERFORM create_notification(
    NEW.following_id,
    NEW.follower_id,
    'follow',
    follower_username || ' started following you'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS like_notification_trigger ON likes;
CREATE TRIGGER like_notification_trigger
AFTER INSERT ON likes
FOR EACH ROW EXECUTE FUNCTION notify_on_like();

DROP TRIGGER IF EXISTS comment_notification_trigger ON comments;
CREATE TRIGGER comment_notification_trigger
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

DROP TRIGGER IF EXISTS follow_notification_trigger ON follows;
CREATE TRIGGER follow_notification_trigger
AFTER INSERT ON follows
FOR EACH ROW EXECUTE FUNCTION notify_on_follow();
