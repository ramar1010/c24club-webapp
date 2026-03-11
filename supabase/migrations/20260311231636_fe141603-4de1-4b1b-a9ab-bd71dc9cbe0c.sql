-- Temporarily disable RLS to insert admin role
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
INSERT INTO public.user_roles (user_id, role) VALUES ('1fc070d1-4891-4e1d-b5e6-7c22ba1a41c5', 'admin');
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;