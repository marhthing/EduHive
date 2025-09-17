
-- Add missing columns to existing reports table
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update the constraint to allow either post_id or comment_id (but not both)
ALTER TABLE reports DROP CONSTRAINT IF EXISTS check_report_target;
ALTER TABLE reports ADD CONSTRAINT check_report_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR 
    (post_id IS NULL AND comment_id IS NOT NULL)
);

-- Make post_id nullable since we can now report comments too
ALTER TABLE reports ALTER COLUMN post_id DROP NOT NULL;

-- Update status constraint to include new values
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (
    status IN ('pending', 'reviewed', 'resolved', 'dismissed')
);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_reports_comment_id ON reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON reports(reported_user_id);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_reports_updated_at_trigger ON reports;
CREATE TRIGGER update_reports_updated_at_trigger
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

-- Update RLS policies
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;

CREATE POLICY "Users can create reports" ON reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON reports
    FOR SELECT USING (auth.uid() = reporter_id);
