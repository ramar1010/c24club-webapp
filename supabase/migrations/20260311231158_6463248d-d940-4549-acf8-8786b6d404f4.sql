
-- Topic categories (e.g. "Advice", "Music", etc.)
CREATE TABLE public.topic_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Individual topics within categories
CREATE TABLE public.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.topic_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User pinned topics (which topics a user has pinned to show on their video call)
CREATE TABLE public.pinned_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

-- Enable RLS
ALTER TABLE public.topic_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_topics ENABLE ROW LEVEL SECURITY;

-- topic_categories: anyone can read, admin can manage
CREATE POLICY "Anyone can read topic categories" ON public.topic_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage topic categories" ON public.topic_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- topics: anyone can read, admin can manage
CREATE POLICY "Anyone can read topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Admins can manage topics" ON public.topics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- pinned_topics: users can manage their own
CREATE POLICY "Users can read own pinned topics" ON public.pinned_topics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pinned topics" ON public.pinned_topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pinned topics" ON public.pinned_topics FOR DELETE TO authenticated USING (auth.uid() = user_id);
