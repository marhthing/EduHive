
-- Create password reset OTPs table
CREATE TABLE password_reset_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create password reset tokens table
CREATE TABLE password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  reset_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_password_reset_otps_email_otp ON password_reset_otps(email, otp_code);
CREATE INDEX idx_password_reset_otps_expires ON password_reset_otps(expires_at);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(reset_token);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Add email column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
    
    -- Update existing profiles with email from auth.users
    UPDATE profiles SET email = auth.users.email 
    FROM auth.users 
    WHERE profiles.user_id = auth.users.id;
  END IF;
END $$;

-- Create function to update user password (admin function)
CREATE OR REPLACE FUNCTION update_user_password(user_id UUID, new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the user's password in auth.users
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = user_id;
END;
$$;

-- Create cleanup function for expired OTPs and tokens
CREATE OR REPLACE FUNCTION cleanup_expired_reset_data()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete expired OTPs
  DELETE FROM password_reset_otps 
  WHERE expires_at < NOW() OR used = TRUE;
  
  -- Delete expired tokens
  DELETE FROM password_reset_tokens 
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$;

-- Enable RLS
ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for OTP tables (admin only)
CREATE POLICY "Only service role can access OTPs" ON password_reset_otps
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can access tokens" ON password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role');
