-- Add spectator mode support
-- Spectators can vote and score points without submitting songs

-- Add is_spectator flag to participants
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS is_spectator BOOLEAN DEFAULT FALSE;

-- Add index for efficient queries filtering by spectator status
CREATE INDEX IF NOT EXISTS idx_participants_spectator
ON public.participants(room_id, is_spectator);

-- Comment for documentation
COMMENT ON COLUMN public.participants.is_spectator IS 'True if participant is a spectator (can vote but did not submit songs)';
