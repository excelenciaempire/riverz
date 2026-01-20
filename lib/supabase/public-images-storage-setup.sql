-- Create public-images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-images', 'public-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for public-images bucket
CREATE POLICY "Allow public read access to public-images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'public-images');

CREATE POLICY "Allow authenticated users to upload public-images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'public-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update public-images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'public-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete public-images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'public-images' AND auth.role() = 'authenticated');
