
-- Add deactivation fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_deactivated BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;

-- Function to deactivate account and hide user content
CREATE OR REPLACE FUNCTION deactivate_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set deactivation status and schedule deletion for 60 days from now
  UPDATE profiles 
  SET 
    is_deactivated = TRUE,
    deactivated_at = NOW(),
    scheduled_deletion_at = NOW() + INTERVAL '60 days'
  WHERE user_id = target_user_id;
  
  -- Hide all posts by setting a hidden flag (we'll add this field)
  UPDATE posts SET is_hidden = TRUE WHERE user_id = target_user_id;
  
  -- Hide all comments
  UPDATE comments SET is_hidden = TRUE WHERE user_id = target_user_id;
  
  -- Remove all likes (they can be restored from audit table if needed)
  DELETE FROM likes WHERE user_id = target_user_id;
  
  -- Remove all follows
  DELETE FROM follows WHERE follower_id = target_user_id OR following_id = target_user_id;
  
  -- Remove all bookmarks
  DELETE FROM bookmarks WHERE user_id = target_user_id;
  
  -- Remove all comment likes
  DELETE FROM comment_likes WHERE user_id = target_user_id;
  
  -- Update follower/following counts for affected users
  UPDATE profiles SET 
    followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = profiles.user_id),
    following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = profiles.user_id)
  WHERE user_id IN (
    SELECT DISTINCT following_id FROM follows WHERE follower_id = target_user_id
    UNION
    SELECT DISTINCT follower_id FROM follows WHERE following_id = target_user_id
  );
END;
$$;

-- Function to reactivate account and restore content
CREATE OR REPLACE FUNCTION reactivate_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if account is within reactivation period
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = target_user_id 
    AND is_deactivated = TRUE 
    AND scheduled_deletion_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Account cannot be reactivated - either not deactivated or past grace period';
  END IF;
  
  -- Reactivate account
  UPDATE profiles 
  SET 
    is_deactivated = FALSE,
    deactivated_at = NULL,
    scheduled_deletion_at = NULL
  WHERE user_id = target_user_id;
  
  -- Restore posts
  UPDATE posts SET is_hidden = FALSE WHERE user_id = target_user_id;
  
  -- Restore comments
  UPDATE comments SET is_hidden = FALSE WHERE user_id = target_user_id;
  
  -- Note: Likes, follows, bookmarks, and comment_likes would need to be restored
  -- from audit tables or backup data if implemented
END;
$$;

-- Function to permanently delete expired accounts
CREATE OR REPLACE FUNCTION delete_expired_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_user RECORD;
BEGIN
  -- Find accounts past their deletion date
  FOR expired_user IN 
    SELECT user_id FROM profiles 
    WHERE is_deactivated = TRUE 
    AND scheduled_deletion_at <= NOW()
  LOOP
    -- Delete all user data
    DELETE FROM notifications WHERE user_id = expired_user.user_id OR actor_id = expired_user.user_id;
    DELETE FROM comment_likes WHERE user_id = expired_user.user_id;
    DELETE FROM bookmarks WHERE user_id = expired_user.user_id;
    DELETE FROM likes WHERE user_id = expired_user.user_id;
    DELETE FROM comments WHERE user_id = expired_user.user_id;
    DELETE FROM posts WHERE user_id = expired_user.user_id;
    DELETE FROM follows WHERE follower_id = expired_user.user_id OR following_id = expired_user.user_id;
    DELETE FROM profiles WHERE user_id = expired_user.user_id;
    
    -- Delete from auth.users (this should cascade properly)
    DELETE FROM auth.users WHERE id = expired_user.user_id;
  END LOOP;
END;
$$;

-- Add hidden field to posts and comments tables
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Update RLS policies to exclude hidden content
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
CREATE POLICY "Posts are viewable by everyone" ON posts
FOR SELECT USING (is_hidden = FALSE OR is_hidden IS NULL);

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
CREATE POLICY "Comments are viewable by everyone" ON comments
FOR SELECT USING (is_hidden = FALSE OR is_hidden IS NULL);

-- Add policy to exclude deactivated profiles from searches
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles
FOR SELECT USING (is_deactivated = FALSE OR is_deactivated IS NULL);
