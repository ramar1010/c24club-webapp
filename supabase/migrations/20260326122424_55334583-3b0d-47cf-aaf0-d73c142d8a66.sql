
-- Fix 1: member_minutes - Replace overly permissive SELECT policy with user-scoped one
-- Drop the current policy that exposes all data
DROP POLICY IF EXISTS "Authenticated can read is_vip status" ON public.member_minutes;

-- Users can only read their own row
CREATE POLICY "Users can read own member_minutes"
  ON public.member_minutes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a security definer function so other users can check VIP status without exposing all columns
CREATE OR REPLACE FUNCTION public.is_user_vip(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_vip FROM public.member_minutes WHERE user_id = _user_id LIMIT 1),
    false
  )
$$;

-- Fix 2: waiting_queue - Replace overly permissive ALL policy
DROP POLICY IF EXISTS "Users can manage own queue entries" ON public.waiting_queue;

-- Users can only read their own queue entries
CREATE POLICY "Users can read own queue entries"
  ON public.waiting_queue
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid()::text);

-- Users can insert their own queue entries
CREATE POLICY "Users can insert own queue entries"
  ON public.waiting_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid()::text);

-- Users can update their own queue entries
CREATE POLICY "Users can update own queue entries"
  ON public.waiting_queue
  FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid()::text);

-- Users can delete their own queue entries
CREATE POLICY "Users can delete own queue entries"
  ON public.waiting_queue
  FOR DELETE
  TO authenticated
  USING (member_id = auth.uid()::text);
