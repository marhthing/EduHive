
-- Allow AI bot to create comments
-- The AI bot uses a special UUID that doesn't exist in auth.users
-- This should match the AI_BOT_USER_ID constant from src/lib/aiBotProfile.ts

-- Create a dummy user entry in auth.users for the AI bot to satisfy foreign key constraints
-- This is a workaround since the AI bot doesn't have a real auth user
INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'authenticated',
  'authenticated',
  'ai@eduhive.com',
  '$2a$10$placeholder.hash.for.ai.bot.user.no.real.login',
  now(),
  null,
  now(),
  '{"provider": "system", "providers": ["system"]}',
  '{"username": "eduhive", "name": "EduHive Assistant", "avatar_url": "/logo.svg"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Drop existing AI bot policies if they exist
DROP POLICY IF EXISTS "AI bot can create comments" ON comments;
DROP POLICY IF EXISTS "AI bot can view its own comments" ON comments;

-- Create policy to allow AI bot to insert comments
CREATE POLICY "AI bot can create comments" ON comments
FOR INSERT WITH CHECK (user_id = '00000000-0000-4000-8000-000000000001'::uuid);

-- Create policy to allow AI bot to view its own comments  
CREATE POLICY "AI bot can view its own comments" ON comments
FOR SELECT USING (user_id = '00000000-0000-4000-8000-000000000001'::uuid);

-- Note: You may need to update this UUID to match the exact value 
-- defined in your src/lib/aiBotProfile.ts file as AI_BOT_USER_ID
