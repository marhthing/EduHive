
-- Allow AI bot to create comments
-- The AI bot uses a special UUID that doesn't exist in auth.users
-- This should match the AI_BOT_USER_ID constant from src/lib/aiBotProfile.ts

-- Create policy to allow AI bot to insert comments
CREATE POLICY "AI bot can create comments" ON comments
FOR INSERT WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Create policy to allow AI bot to view its own comments  
CREATE POLICY "AI bot can view its own comments" ON comments
FOR SELECT USING (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Note: You may need to update this UUID to match the exact value 
-- defined in your src/lib/aiBotProfile.ts file as AI_BOT_USER_ID
