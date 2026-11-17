-- Tabela para persistir os títulos salvos em "Minha Lista" por usuário autenticado.
-- Execute este script no SQL Editor do seu projeto Supabase.

create table if not exists public.user_my_list (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 128),
  title text not null check (char_length(title) between 1 and 500),
  kind text not null check (kind in ('Filme', 'Série', 'Anime')),
  year integer not null check (year >= 0),
  duration text not null default '',
  genres text[] not null default '{}',
  service text not null check (char_length(service) > 0),
  services text[],
  imdb_rating text not null default '',
  metacritic_score integer,
  synopsis text not null default '',
  color text not null,
  icon text not null check (icon in ('movie', 'live-tv', 'theaters')),
  rating_source text check (rating_source is null or rating_source in ('IMDb', 'TMDB')),
  catalog_source text check (catalog_source is null or catalog_source = 'tmdb'),
  tmdb_poster_path text,
  tmdb_backdrop_path text,
  original_title text,
  popularity double precision,
  vote_count integer,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create index if not exists idx_user_my_list_user_created_at
  on public.user_my_list (user_id, created_at desc);

alter table public.user_my_list enable row level security;

drop policy if exists "Users can view their own my list" on public.user_my_list;
create policy "Users can view their own my list"
  on public.user_my_list
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert into their own my list" on public.user_my_list;
create policy "Users can insert into their own my list"
  on public.user_my_list
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own my list" on public.user_my_list;
create policy "Users can update their own my list"
  on public.user_my_list
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete from their own my list" on public.user_my_list;
create policy "Users can delete from their own my list"
  on public.user_my_list
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
