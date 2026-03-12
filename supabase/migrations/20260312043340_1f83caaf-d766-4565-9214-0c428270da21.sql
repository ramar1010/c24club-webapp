
-- Spin prizes configuration table (admin-managed)
CREATE TABLE public.spin_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_type text NOT NULL, -- 'product_points', 'ad_points', 'bonus_minutes', 'unfreeze', 'vip_week', 'gift_card', 'chance_enhancer'
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  chance_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Spin results tracking table
CREATE TABLE public.spin_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prize_id uuid REFERENCES public.spin_prizes(id) ON DELETE SET NULL,
  prize_type text NOT NULL,
  prize_label text NOT NULL,
  prize_amount numeric NOT NULL DEFAULT 0,
  awarded boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.spin_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;

-- RLS for spin_prizes: admins manage, everyone can read active
CREATE POLICY "Admins can manage spin_prizes" ON public.spin_prizes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read active spin_prizes" ON public.spin_prizes FOR SELECT TO authenticated
  USING (is_active = true);

-- RLS for spin_results: admins see all, users see own
CREATE POLICY "Admins can manage spin_results" ON public.spin_results FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own spin_results" ON public.spin_results FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spin_results" ON public.spin_results FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Seed default prizes
INSERT INTO public.spin_prizes (prize_type, label, amount, chance_percent, sort_order) VALUES
  ('product_points', '+1 Product Point', 1, 4, 1),
  ('ad_points', '300 Ad Points', 300, 90, 2),
  ('bonus_minutes', '99 Bonus Minutes', 99, 90, 3),
  ('unfreeze', '1 Unfreeze (7 days)', 7, 80, 4),
  ('vip_week', '$2.49 VIP for a Week', 2.49, 20, 5),
  ('gift_card', '$15 Gift Card', 15, 2, 6),
  ('chance_enhancer', '10%+ Chance Enhancer', 10, 50, 7);
