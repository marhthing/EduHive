
-- Drop and recreate the trigger function with better error handling and logging
DROP TRIGGER IF EXISTS update_follow_counts_trigger ON follows;
DROP FUNCTION IF EXISTS update_follow_counts();

-- Recreate the function with better logic
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following count for follower
    UPDATE profiles 
    SET following_count = following_count + 1,
        updated_at = NOW()
    WHERE user_id = NEW.follower_id;
    
    -- Increment followers count for the person being followed
    UPDATE profiles 
    SET followers_count = followers_count + 1,
        updated_at = NOW()
    WHERE user_id = NEW.following_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement following count for follower (ensure it doesn't go below 0)
    UPDATE profiles 
    SET following_count = GREATEST(following_count - 1, 0),
        updated_at = NOW()
    WHERE user_id = OLD.follower_id;
    
    -- Decrement followers count for the person being unfollowed (ensure it doesn't go below 0)
    UPDATE profiles 
    SET followers_count = GREATEST(followers_count - 1, 0),
        updated_at = NOW()
    WHERE user_id = OLD.following_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_follow_counts_trigger
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Also let's recalculate all existing counts to fix any inconsistencies
UPDATE profiles SET 
  followers_count = (
    SELECT COUNT(*) FROM follows WHERE following_id = profiles.user_id
  ),
  following_count = (
    SELECT COUNT(*) FROM follows WHERE follower_id = profiles.user_id
  ),
  updated_at = NOW();
