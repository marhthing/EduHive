-- Fix ambiguous column reference in create_mention_notifications function
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
  username_var TEXT;  -- Renamed variable to avoid ambiguity
  notification_message TEXT;
BEGIN
  -- Get the username of the person doing the mentioning
  SELECT username INTO from_username FROM profiles WHERE user_id = p_from_user_id;
  
  -- Loop through each mentioned username
  FOREACH username_var IN ARRAY p_mentioned_usernames
  LOOP
    -- Skip AI bot mentions
    IF username_var = 'eduhive' THEN
      CONTINUE;
    END IF;
    
    -- Find the user ID for this username (fixed ambiguity by using table qualification)
    SELECT user_id INTO mentioned_user_id 
    FROM profiles 
    WHERE profiles.username = username_var;
    
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