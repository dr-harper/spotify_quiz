-- Add track metadata columns to submissions for trivia questions
alter table public.submissions
add column if not exists album_name varchar(500),
add column if not exists release_year integer,
add column if not exists duration_ms integer,
add column if not exists popularity integer,
add column if not exists tempo real,
add column if not exists valence real,
add column if not exists danceability real,
add column if not exists energy real;

-- Add index for trivia queries
create index if not exists idx_submissions_release_year on public.submissions(release_year);
