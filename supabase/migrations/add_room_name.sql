-- Adds an optional display name for rooms
alter table public.rooms
add column if not exists name varchar(80);
