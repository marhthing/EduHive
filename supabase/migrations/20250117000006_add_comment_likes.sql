
-- Add parent_comment_id to comments table for replies
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_id_idx ON comment_likes(user_id);

-- RLS policies for comment_likes
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Users can view all comment likes
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes
FOR SELECT USING (true);

-- Users can insert their own comment likes
CREATE POLICY "Users can insert their own comment likes" ON comment_likes
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comment likes
CREATE POLICY "Users can delete their own comment likes" ON comment_likes
FOR DELETE USING (auth.uid() = user_id);

-- Function to create comment like notifications
CREATE OR REPLACE FUNCTION notify_on_comment_like()
RETURNS TRIGGER AS $$
DECLARE
  comment_owner_id UUID;
  liker_username TEXT;
BEGIN
  -- Get comment owner
  SELECT user_id INTO comment_owner_id FROM comments WHERE id = NEW.comment_id;
  
  -- Get liker username
  SELECT username INTO liker_username FROM profiles WHERE user_id = NEW.user_id;
  
  -- Create notification
  PERFORM create_notification(
    comment_owner_id,
    NEW.user_id,
    'like',
    liker_username || ' liked your comment',
    NULL,
    NEW.comment_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment like notifications
DROP TRIGGER IF EXISTS comment_like_notification_trigger ON comment_likes;
CREATE TRIGGER comment_like_notification_trigger
AFTER INSERT ON comment_likes
FOR EACH ROW EXECUTE FUNCTION notify_on_comment_like();

-- Update comment reply notifications to handle parent comments
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  parent_comment_owner_id UUID;
  commenter_username TEXT;
BEGIN
  -- Get commenter username
  SELECT username INTO commenter_username FROM profiles WHERE user_id = NEW.user_id;
  
  -- If this is a reply to another comment
  IF NEW.parent_comment_id IS NOT NULL THEN
    -- Get parent comment owner
    SELECT user_id INTO parent_comment_owner_id FROM comments WHERE id = NEW.parent_comment_id;
    
    -- Create notification for parent comment owner
    PERFORM create_notification(
      parent_comment_owner_id,
      NEW.user_id,
      'reply',
      commenter_username || ' replied to your comment',
      NEW.post_id,
      NEW.id
    );
  ELSE
    -- Get post owner
    SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
    
    -- Create notification for post owner
    PERFORM create_notification(
      post_owner_id,
      NEW.user_id,
      'comment',
      commenter_username || ' commented on your post',
      NEW.post_id,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger
DROP TRIGGER IF EXISTS comment_notification_trigger ON comments;
CREATE TRIGGER comment_notification_trigger
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION notify_on_comment();
