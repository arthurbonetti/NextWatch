-- Tabela para persistir o progresso de temporadas e episódios assistidos por usuário autenticado.

create table if not exists public.user_series_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null check (char_length(title_id) between 1 and 128),
  progress jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object'),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, title_id)
);

alter table public.user_series_progress enable row level security;

grant select, insert, update, delete on table public.user_series_progress to authenticated;

create policy "Users can view their own series progress"
  on public.user_series_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own series progress"
  on public.user_series_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own series progress"
  on public.user_series_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own series progress"
  on public.user_series_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
