-- Festive Frequencies Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rejdrockqfbidkfhyzqk/sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Rooms table - holds game sessions
create table if not exists public.rooms (
  id uuid primary key default uuid_generate_v4(),
  room_code varchar(10) unique not null,
  host_id uuid not null,
  name varchar(80),
  status varchar(20) not null default 'LOBBY'
    check (status in ('LOBBY', 'SUBMITTING', 'PLAYING', 'RESULTS')),
  current_round integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Participants table - users in a room
create table if not exists public.participants (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  spotify_id varchar(255) not null,
  display_name varchar(255) not null,
  avatar_url text,
  score integer default 0,
  is_host boolean default false,
  has_submitted boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(room_id, user_id)
);

-- Submissions table - songs submitted by participants
create table if not exists public.submissions (
  id uuid primary key default uuid_generate_v4(),
  participant_id uuid references public.participants(id) on delete cascade,
  track_id varchar(255) not null,
  track_name varchar(500) not null,
  artist_name varchar(500) not null,
  album_art_url text,
  preview_url text not null,
  submission_order integer not null,
  played boolean default false,
  -- Track metadata for trivia
  album_name varchar(500),
  release_year integer,
  duration_ms integer,
  popularity integer,
  tempo real,
  valence real,
  danceability real,
  energy real,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Quiz rounds table - tracks which song is being played
create table if not exists public.quiz_rounds (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  round_number integer not null,
  started_at timestamp with time zone,
  ended_at timestamp with time zone
);

-- Votes table - player guesses
create table if not exists public.votes (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid references public.quiz_rounds(id) on delete cascade,
  voter_id uuid references public.participants(id) on delete cascade,
  guessed_participant_id uuid references public.participants(id) on delete cascade,
  is_correct boolean,
  points_awarded integer default 0,
  voted_at timestamp with time zone default timezone('utc'::text, now()),
  unique(round_id, voter_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.submissions enable row level security;
alter table public.quiz_rounds enable row level security;
alter table public.votes enable row level security;

-- Rooms policies
create policy "Anyone can view rooms by code" on public.rooms
  for select using (true);

create policy "Authenticated users can create rooms" on public.rooms
  for insert with check (auth.uid() is not null);

create policy "Hosts can update their rooms" on public.rooms
  for update using (host_id = auth.uid());

-- Participants policies
create policy "Anyone can view participants in a room" on public.participants
  for select using (true);

create policy "Authenticated users can join rooms" on public.participants
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own participant record" on public.participants
  for update using (user_id = auth.uid());

-- Submissions policies
create policy "Participants can view submissions in their room" on public.submissions
  for select using (
    exists (
      select 1 from public.participants p
      where p.id = submissions.participant_id
    )
  );

create policy "Participants can insert their submissions" on public.submissions
  for insert with check (
    exists (
      select 1 from public.participants p
      where p.id = participant_id and p.user_id = auth.uid()
    )
    
  );

-- Quiz rounds policies
create policy "Anyone can view quiz rounds" on public.quiz_rounds
  for select using (true);

create policy "Hosts can create quiz rounds" on public.quiz_rounds
  for insert with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

create policy "Hosts can update quiz rounds" on public.quiz_rounds
  for update using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

-- Votes policies
create policy "Anyone can view votes" on public.votes
  for select using (true);

create policy "Participants can vote" on public.votes
  for insert with check (
    exists (
      select 1 from public.participants p
      where p.id = voter_id and p.user_id = auth.uid()
    )
  );

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime for these tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.quiz_rounds;
alter publication supabase_realtime add table public.votes;

-- ============================================
-- INDEXES
-- ============================================

create index if not exists idx_rooms_code on public.rooms(room_code);
create index if not exists idx_participants_room on public.participants(room_id);
create index if not exists idx_participants_user on public.participants(user_id);
create index if not exists idx_submissions_participant on public.submissions(participant_id);
create index if not exists idx_quiz_rounds_room on public.quiz_rounds(room_id);
create index if not exists idx_votes_round on public.votes(round_id);
