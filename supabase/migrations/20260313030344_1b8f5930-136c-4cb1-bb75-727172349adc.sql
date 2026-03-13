
-- Gift cards table for manual code management
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  value_amount numeric NOT NULL DEFAULT 0,
  code text NOT NULL,
  minutes_cost integer NOT NULL DEFAULT 0,
  image_url text,
  status text NOT NULL DEFAULT 'available',
  claimed_by uuid,
  claimed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Admins can manage all gift cards
CREATE POLICY "Admins can manage gift_cards"
  ON public.gift_cards FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read available gift cards (not the codes though - we'll handle that in edge function)
CREATE POLICY "Users can read available gift_cards"
  ON public.gift_cards FOR SELECT
  TO authenticated
  USING (status = 'available');

-- Users can read their own claimed gift cards
CREATE POLICY "Users can read own claimed gift_cards"
  ON public.gift_cards FOR SELECT
  TO authenticated
  USING (claimed_by = auth.uid());
