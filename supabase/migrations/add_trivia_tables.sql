-- Migration: Add trivia round tables
-- Run this in Supabase SQL Editor

-- Trivia questions generated per game
CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('data', 'ai')),
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- ["Option A", "Option B", "Option C", "Option D"]
  correct_index INT NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  explanation TEXT,
  related_track_id TEXT, -- Spotify track ID if question is about a specific song
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trivia answers from participants
CREATE TABLE IF NOT EXISTS public.trivia_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  selected_index INT, -- NULL if they didn't answer in time
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  points_awarded INT NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, participant_id)
);

-- Enable RLS
ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trivia_questions
CREATE POLICY "Anyone can view trivia questions for rooms they're in"
  ON public.trivia_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.room_id = trivia_questions.room_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can insert trivia questions"
  ON public.trivia_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.room_id = room_id
      AND p.user_id = auth.uid()
    )
  );

-- RLS Policies for trivia_answers
CREATE POLICY "Anyone can view trivia answers for rooms they're in"
  ON public.trivia_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trivia_questions tq
      JOIN public.participants p ON p.room_id = tq.room_id
      WHERE tq.id = trivia_answers.question_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can insert their own trivia answers"
  ON public.trivia_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id
      AND p.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trivia_questions_room_id ON public.trivia_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_trivia_answers_question_id ON public.trivia_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_trivia_answers_participant_id ON public.trivia_answers(participant_id);

-- Add comment
COMMENT ON TABLE public.trivia_questions IS 'Multiple choice trivia questions generated for each game based on submitted songs';
COMMENT ON TABLE public.trivia_answers IS 'Player answers to trivia questions';
