ALTER TABLE public.bounty_attributions
  DROP CONSTRAINT IF EXISTS bounty_attributions_interaction_type_check;
ALTER TABLE public.bounty_attributions
  ADD CONSTRAINT bounty_attributions_interaction_type_check
  CHECK (interaction_type = ANY (ARRAY['call'::text, 'dm'::text, 'dm_two_way'::text]));