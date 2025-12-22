-- Migration: Allow test participants with null user_id
-- Run this in Supabase SQL Editor if you want multi-player test data

-- Drop the unique constraint that prevents multiple participants per user
ALTER TABLE public.participants
DROP CONSTRAINT IF EXISTS participants_room_id_user_id_key;

-- Add a new unique constraint that only applies when user_id is not null
-- This allows multiple participants with null user_id in the same room
CREATE UNIQUE INDEX participants_room_user_unique
ON public.participants (room_id, user_id)
WHERE user_id IS NOT NULL;

-- Update RLS policy to allow inserts with null user_id (for test data)
DROP POLICY IF EXISTS "Authenticated users can join rooms" ON public.participants;

CREATE POLICY "Authenticated users can join rooms" ON public.participants
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      user_id IS NULL  -- Allow test participants
    )
  );

-- Add policy to allow updates on test participants
DROP POLICY IF EXISTS "Users can update their own participant record" ON public.participants;

CREATE POLICY "Users can update participant records" ON public.participants
  FOR UPDATE USING (
    user_id = auth.uid() OR
    user_id IS NULL  -- Allow updating test participants
  );
