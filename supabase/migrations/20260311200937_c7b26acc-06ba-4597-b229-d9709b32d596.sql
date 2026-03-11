
-- 1. Reward Categories table
CREATE TABLE public.reward_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  show_as TEXT NOT NULL DEFAULT 'Only as normal Reward',
  status TEXT NOT NULL DEFAULT 'active',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage categories" ON public.reward_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read active categories" ON public.reward_categories
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- 2. Add columns to existing rewards table
ALTER TABLE public.rewards
  ADD COLUMN category_id UUID REFERENCES public.reward_categories(id) ON DELETE SET NULL,
  ADD COLUMN sub_type TEXT,
  ADD COLUMN delivery TEXT DEFAULT 'digital',
  ADD COLUMN rarity TEXT NOT NULL DEFAULT 'common',
  ADD COLUMN product_name TEXT,
  ADD COLUMN sizes TEXT,
  ADD COLUMN visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN ships_to TEXT[],
  ADD COLUMN brief TEXT,
  ADD COLUMN image_url TEXT,
  ADD COLUMN minutes_cost INTEGER NOT NULL DEFAULT 0;

-- Allow public to read visible rewards
CREATE POLICY "Public can read visible rewards" ON public.rewards
  FOR SELECT TO anon, authenticated
  USING (visible = true);

-- 3. Milestones table
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  unlock_minutes INTEGER NOT NULL DEFAULT 0,
  enable_shipping BOOLEAN NOT NULL DEFAULT true,
  vip_only BOOLEAN NOT NULL DEFAULT false,
  brief TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage milestones" ON public.milestones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read milestones" ON public.milestones
  FOR SELECT TO anon, authenticated
  USING (true);

-- 4. Milestone-Rewards junction table
CREATE TABLE public.milestone_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL DEFAULT 'mandatory',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.milestone_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage milestone_rewards" ON public.milestone_rewards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read milestone_rewards" ON public.milestone_rewards
  FOR SELECT TO anon, authenticated
  USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_reward_categories_updated_at BEFORE UPDATE ON public.reward_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
