
ALTER TABLE public.member_minutes 
ADD COLUMN vip_tier text DEFAULT null,
ADD COLUMN subscription_end timestamp with time zone DEFAULT null,
ADD COLUMN stripe_customer_id text DEFAULT null;
