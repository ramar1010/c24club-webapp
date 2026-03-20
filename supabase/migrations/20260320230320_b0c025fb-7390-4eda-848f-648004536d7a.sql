
-- Create storage bucket for bestie screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('bestie-screenshots', 'bestie-screenshots', false);

-- RLS: users can upload their own screenshots
CREATE POLICY "Users can upload bestie screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bestie-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: admins can read all screenshots  
CREATE POLICY "Admins can read bestie screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bestie-screenshots' AND has_role(auth.uid(), 'admin'));

-- RLS: users can read own screenshots
CREATE POLICY "Users can read own bestie screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bestie-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
