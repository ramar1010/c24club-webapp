GRANT SELECT, INSERT, UPDATE ON TABLE public.members TO authenticated;
GRANT SELECT ON TABLE public.members TO anon;
GRANT ALL ON TABLE public.members TO service_role;