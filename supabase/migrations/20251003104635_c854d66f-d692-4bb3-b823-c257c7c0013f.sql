-- Add RLS policies for error-reports storage bucket

-- Allow authenticated users to upload files to error-reports bucket
CREATE POLICY "Users can upload error report files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'error-reports');

-- Allow authenticated users to view error report files
CREATE POLICY "Users can view error report files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'error-reports');

-- Allow users to delete their own uploaded files
CREATE POLICY "Users can delete their own error report files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'error-reports');