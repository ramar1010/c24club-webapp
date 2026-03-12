ALTER TABLE public.rewards 
  ADD COLUMN feature_image_url text DEFAULT NULL,
  ADD COLUMN variation_images text[] DEFAULT '{}',
  ADD COLUMN color_options jsonb DEFAULT '[]';