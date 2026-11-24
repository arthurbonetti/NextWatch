-- Avaliação pessoal de filmes e séries pelo usuário, em escala inteira de 0 a 5 estrelas.

create table if not exists public.user_title_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 128),
  rating smallint not null check (rating between 0 and 5),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, title_id)
);

alter table public.user_title_ratings enable row level security;

grant select, insert, update, delete on table public.user_title_ratings to authenticated;

create policy "Users can view their own title ratings"
  on public.user_title_ratings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own title ratings"
  on public.user_title_ratings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own title ratings"
  on public.user_title_ratings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own title ratings"
  on public.user_title_ratings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
