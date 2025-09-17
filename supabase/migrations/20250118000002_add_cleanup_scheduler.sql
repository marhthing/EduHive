
-- Create a function that can be called periodically to clean up expired accounts
-- This should be called by a scheduled job (cron, etc.)
CREATE OR REPLACE FUNCTION cleanup_expired_accounts()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_deleted INTEGER := 0;
  expired_user RECORD;
BEGIN
  -- Log cleanup start
  RAISE NOTICE 'Starting cleanup of expired deactivated accounts at %', NOW();
  
  -- Find and delete expired accounts
  FOR expired_user IN 
    SELECT user_id, scheduled_deletion_at
    FROM profiles 
    WHERE is_deactivated = TRUE 
    AND scheduled_deletion_at <= NOW()
  LOOP
    -- Delete all user data in correct order to maintain referential integrity
    DELETE FROM notifications WHERE user_id = expired_user.user_id OR actor_id = expired_user.user_id;
    DELETE FROM comment_likes WHERE user_id = expired_user.user_id;
    DELETE FROM bookmarks WHERE user_id = expired_user.user_id;
    DELETE FROM likes WHERE user_id = expired_user.user_id;
    DELETE FROM comments WHERE user_id = expired_user.user_id;
    DELETE FROM posts WHERE user_id = expired_user.user_id;
    DELETE FROM follows WHERE follower_id = expired_user.user_id OR following_id = expired_user.user_id;
    DELETE FROM profiles WHERE user_id = expired_user.user_id;
    
    -- Delete from auth.users last
    DELETE FROM auth.users WHERE id = expired_user.user_id;
    
    count_deleted := count_deleted + 1;
    
    RAISE NOTICE 'Deleted expired account: % (scheduled for deletion: %)', 
      expired_user.user_id, expired_user.scheduled_deletion_at;
  END LOOP;
  
  RAISE NOTICE 'Cleanup completed. Deleted % accounts', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

-- Add an index to improve performance of cleanup queries
CREATE INDEX IF NOT EXISTS idx_profiles_deactivated_scheduled 
ON profiles(is_deactivated, scheduled_deletion_at) 
WHERE is_deactivated = TRUE;
