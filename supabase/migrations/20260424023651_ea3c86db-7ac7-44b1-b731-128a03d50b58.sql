ALTER TABLE public.reward_categories ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.reward_categories
)
UPDATE public.reward_categories rc
SET display_order = ordered.rn
FROM ordered
WHERE rc.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_reward_categories_display_order ON public.reward_categories(display_order);