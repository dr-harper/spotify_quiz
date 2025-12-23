-- Add AI summary and mood tag columns to participants table
-- These store the AI-generated music taste summary shown in the song library

ALTER TABLE participants
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS mood_tag TEXT;

-- Add comment for documentation
COMMENT ON COLUMN participants.ai_summary IS 'AI-generated summary of the participant''s music taste based on their song picks';
COMMENT ON COLUMN participants.mood_tag IS 'Two-word playful mood descriptor for the participant''s music style (e.g. "Indie Dreamer", "Pop Royalty")';
