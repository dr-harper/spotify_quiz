-- Migration: Add favourite songs voting table
-- Players vote for their top 3 favourite songs at the end of the game
-- Each vote received = 50 points for the song owner

-- Favourite song votes table
CREATE TABLE IF NOT EXISTS public.favourite_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each voter can only vote for a song once
  UNIQUE(voter_id, submission_id)
);

-- Enable RLS
ALTER TABLE public.favourite_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view favourite votes for rooms they're in"
  ON public.favourite_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.room_id = favourite_votes.room_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can insert their own favourite votes"
  ON public.favourite_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = voter_id
      AND p.user_id = auth.uid()
    )
  );

-- Enable realtime for live vote tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.favourite_votes;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_favourite_votes_room_id ON public.favourite_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_favourite_votes_voter_id ON public.favourite_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_favourite_votes_submission_id ON public.favourite_votes(submission_id);

-- Update room status constraint to include FAVOURITES
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('LOBBY', 'SUBMITTING', 'PLAYING_ROUND_1', 'TRIVIA', 'PLAYING_ROUND_2', 'FAVOURITES', 'RESULTS'));

COMMENT ON TABLE public.favourite_votes IS 'Player votes for their favourite songs from the game (top 3 picks, 50 points each)';
