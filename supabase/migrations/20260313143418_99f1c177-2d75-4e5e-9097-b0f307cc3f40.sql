
-- Add screenshot_url column to user_reports
ALTER TABLE public.user_reports ADD COLUMN screenshot_url text;

-- Create storage bucket for report screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-screenshots', 'report-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload screenshots
CREATE POLICY "Users can upload report screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'report-screenshots');

-- RLS: admins can view report screenshots
CREATE POLICY "Admins can view report screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'report-screenshots' AND public.has_role(auth.uid(), 'admin'));

-- RLS: reporter can view own report screenshots
CREATE POLICY "Users can view own report screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'report-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
