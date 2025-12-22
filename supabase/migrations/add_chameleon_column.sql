-- Add chameleon mode column to submissions
-- A chameleon song is one that the player picks to disguise as someone else's taste
alter table public.submissions
add column if not exists is_chameleon boolean default false;

-- Add index for efficient querying of chameleon songs
create index if not exists idx_submissions_is_chameleon on public.submissions(is_chameleon);
