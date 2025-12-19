-- Enhanced database schema to handle rich CSV data
-- This should be run in your Supabase SQL editor

-- Update mail_scans table to include more detailed fields
ALTER TABLE mail_scans 
ADD COLUMN IF NOT EXISTS pin_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India',
ADD COLUMN IF NOT EXISTS extraction_confidence INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS original_text TEXT,
ADD COLUMN IF NOT EXISTS processing_notes TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mail_scans_sorting_center ON mail_scans(sorting_center_id);
CREATE INDEX IF NOT EXISTS idx_mail_scans_city ON mail_scans(city);
CREATE INDEX IF NOT EXISTS idx_mail_scans_confidence ON mail_scans(extraction_confidence);
CREATE INDEX IF NOT EXISTS idx_mail_scans_created_at ON mail_scans(created_at);

-- Create a view for geographic analysis
CREATE OR REPLACE VIEW mail_scan_analytics AS
SELECT 
  sorting_center_id,
  sorting_center_name,
  city,
  state,
  country,
  COUNT(*) as total_scans,
  AVG(extraction_confidence) as avg_confidence,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_scans,
  COUNT(CASE WHEN extraction_confidence >= 95 THEN 1 END) as high_confidence_scans,
  MAX(created_at) as last_activity,
  MIN(created_at) as first_activity
FROM mail_scans 
WHERE sorting_center_id IS NOT NULL 
  AND sorting_center_id != ''
  AND sorting_center_id != 'N/A'
GROUP BY sorting_center_id, sorting_center_name, city, state, country
ORDER BY total_scans DESC;