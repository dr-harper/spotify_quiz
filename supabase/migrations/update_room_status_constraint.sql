-- Migration: Update room status constraint for 3-round structure
-- Run this in Supabase SQL Editor

-- Drop the existing status check constraint
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;

-- Add new check constraint with updated status values
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('LOBBY', 'SUBMITTING', 'PLAYING_ROUND_1', 'TRIVIA', 'PLAYING_ROUND_2', 'RESULTS'));

-- Migrate any existing 'PLAYING' status to 'PLAYING_ROUND_1'
UPDATE public.rooms SET status = 'PLAYING_ROUND_1' WHERE status = 'PLAYING';
