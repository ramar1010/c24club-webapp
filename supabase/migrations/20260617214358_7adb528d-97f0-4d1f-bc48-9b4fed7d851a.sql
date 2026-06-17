ALTER TABLE public.bounty_earnings
  ADD CONSTRAINT bounty_earnings_male_id_fkey
  FOREIGN KEY (male_id) REFERENCES public.members(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.bounty_earnings
  ADD CONSTRAINT bounty_earnings_female_id_fkey
  FOREIGN KEY (female_id) REFERENCES public.members(id) ON DELETE CASCADE NOT VALID;