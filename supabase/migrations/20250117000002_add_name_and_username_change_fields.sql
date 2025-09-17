
-- Add name field and username change tracking to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS last_username_change TIMESTAMPTZ;

-- Update existing profiles to have a name based on username (temporary)
UPDATE profiles 
SET name = INITCAP(REPLACE(username, '_', ' ')) 
WHERE name IS NULL;
