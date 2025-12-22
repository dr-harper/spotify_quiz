-- Migration: Add game settings to rooms table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Add settings column to rooms table
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{
  "songsRequired": 10,
  "christmasSongsRequired": 0,
  "chameleonMode": false,
  "guessTimerSeconds": null,
  "previewLengthSeconds": 30,
  "revealAfterEachRound": false,
  "allowDuplicateSongs": false,
  "lobbyMusic": true
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.rooms.settings IS 'Game configuration settings set by host. JSON schema:
{
  "songsRequired": number (5, 10, or 15),
  "christmasSongsRequired": number (0 = none, or min number of Christmas songs),
  "chameleonMode": boolean (pick a song others might pick),
  "guessTimerSeconds": number | null (null = unlimited, 15, or 30),
  "previewLengthSeconds": number (15 or 30),
  "revealAfterEachRound": boolean (show answer after each round),
  "allowDuplicateSongs": boolean (can players pick same song),
  "lobbyMusic": boolean (play music in lobby)
}';
