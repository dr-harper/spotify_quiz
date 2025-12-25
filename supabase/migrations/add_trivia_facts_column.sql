-- Add trivia_facts column to submissions table
-- Stores AI-generated trivia facts with citations for each submitted track

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS trivia_facts JSONB DEFAULT NULL;

-- Example format:
-- [
--   {"fact": "Featured in Love Actually (2003)", "source": "Wikipedia", "category": "film"},
--   {"fact": "Reached #1 in 16 countries", "source": "Billboard", "category": "chart"}
-- ]

COMMENT ON COLUMN submissions.trivia_facts IS 'AI-generated trivia facts with citations, generated at submission time';
