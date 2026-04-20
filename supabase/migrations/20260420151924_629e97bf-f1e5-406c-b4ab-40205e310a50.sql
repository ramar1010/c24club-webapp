-- Restore public SELECT policy on member-photos bucket so that upsert and rendering work.
-- The bucket is public; this just allows the storage API to read object metadata.
CREATE POLICY "Anyone can view member photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'member-photos');

-- Restore for promo-images and blog-images too (also public buckets)
CREATE POLICY "Anyone can view promo images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'promo-images');

CREATE POLICY "Anyone can read blog images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-images');