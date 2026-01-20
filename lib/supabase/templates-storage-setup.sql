-- Create templates storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for templates bucket
CREATE POLICY "Allow public read access to templates" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'templates');

CREATE POLICY "Allow authenticated users to upload templates" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'templates' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update templates" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'templates' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete templates" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'templates' AND auth.role() = 'authenticated');
