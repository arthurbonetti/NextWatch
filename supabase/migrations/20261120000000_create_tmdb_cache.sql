-- Tabela de cache L2 para respostas da Edge Function tmdb-proxy.
-- Acesso direto bloqueado para anon e authenticated via privilégios mínimos e RLS.

create table if not exists public.tmdb_cache (
  cache_key text primary key check (char_length(cache_key) between 1 and 512),
  payload jsonb not null,
  status_code smallint not null default 200 check (status_code between 200 and 299),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_tmdb_cache_expires_at
  on public.tmdb_cache (expires_at);

alter table public.tmdb_cache enable row level security;

revoke all on table public.tmdb_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.tmdb_cache to service_role;

drop policy if exists "Deny direct access to tmdb_cache for anon and authenticated" on public.tmdb_cache;
create policy "Deny direct access to tmdb_cache for anon and authenticated"
  on public.tmdb_cache
  for all
  to anon, authenticated
  using (false)
  with check (false);
