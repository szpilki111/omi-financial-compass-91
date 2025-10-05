-- Add 'needs_info' to error_report_status enum
ALTER TYPE error_report_status ADD VALUE IF NOT EXISTS 'needs_info';