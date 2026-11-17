-- Endurecimento de controle de acesso (RLS), integridade referencial, privilégios mínimos
-- e validações no servidor para public.user_subscriptions e public.user_my_list.

-- 1. public.user_subscriptions: tipo uuid, FK para auth.users, NOT NULL e CHECK constraints
alter table public.user_subscriptions
  alter column user_id type uuid using user_id::uuid,
  alter column user_id set not null,
  alter column subscription_id set not null,
  alter column provider set not null,
  alter column monthly_price set not null,
  alter column billing_day set not null,
  alter column active set not null,
  alter column renewal_alert set not null,
  alter column alert_days set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_subscriptions_user_id_fkey'
      and conrelid = 'public.user_subscriptions'::regclass
  ) then
    alter table public.user_subscriptions
      add constraint user_subscriptions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_id_check,
  drop constraint if exists user_subscriptions_provider_check,
  drop constraint if exists user_subscriptions_monthly_price_check,
  drop constraint if exists user_subscriptions_billing_day_check,
  drop constraint if exists user_subscriptions_alert_days_check;

alter table public.user_subscriptions
  add constraint user_subscriptions_id_check
    check (subscription_id ~ '^[a-z0-9-]{1,128}$'),
  add constraint user_subscriptions_provider_check
    check (
      provider in (
        'Netflix', 'Disney+', 'Max', 'Prime Video',
        'Apple TV+', 'Globoplay', 'Crunchyroll'
      )
    ),
  add constraint user_subscriptions_monthly_price_check
    check (monthly_price > 0 and monthly_price <= 10000),
  add constraint user_subscriptions_billing_day_check
    check (billing_day between 1 and 31),
  add constraint user_subscriptions_alert_days_check
    check (alert_days in (1, 3, 7));

create index if not exists idx_user_subscriptions_user_id
  on public.user_subscriptions (user_id);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Allow all operations for public and authenticated" on public.user_subscriptions;
drop policy if exists "Users can view their own subscriptions" on public.user_subscriptions;
drop policy if exists "Users can insert their own subscriptions" on public.user_subscriptions;
drop policy if exists "Users can update their own subscriptions" on public.user_subscriptions;
drop policy if exists "Users can delete their own subscriptions" on public.user_subscriptions;

create policy "Users can view their own subscriptions"
  on public.user_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own subscriptions"
  on public.user_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own subscriptions"
  on public.user_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own subscriptions"
  on public.user_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 2. public.user_my_list: CHECK constraints de tamanho/formato e RLS otimizada
alter table public.user_my_list
  drop constraint if exists user_my_list_duration_len_check,
  drop constraint if exists user_my_list_service_len_check,
  drop constraint if exists user_my_list_imdb_rating_len_check,
  drop constraint if exists user_my_list_metacritic_range_check,
  drop constraint if exists user_my_list_synopsis_len_check,
  drop constraint if exists user_my_list_color_hex_check,
  drop constraint if exists user_my_list_original_title_len_check,
  drop constraint if exists user_my_list_poster_path_check,
  drop constraint if exists user_my_list_backdrop_path_check,
  drop constraint if exists user_my_list_genres_len_check,
  drop constraint if exists user_my_list_services_len_check,
  drop constraint if exists user_my_list_popularity_check,
  drop constraint if exists user_my_list_vote_count_check;

alter table public.user_my_list
  add constraint user_my_list_duration_len_check check (char_length(duration) <= 64),
  add constraint user_my_list_service_len_check check (char_length(service) between 1 and 64),
  add constraint user_my_list_imdb_rating_len_check check (char_length(imdb_rating) <= 16),
  add constraint user_my_list_metacritic_range_check check (metacritic_score is null or metacritic_score between 0 and 100),
  add constraint user_my_list_synopsis_len_check check (char_length(synopsis) <= 4000),
  add constraint user_my_list_color_hex_check check (color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint user_my_list_original_title_len_check check (original_title is null or char_length(original_title) <= 500),
  add constraint user_my_list_poster_path_check check (tmdb_poster_path is null or tmdb_poster_path ~ '^/[a-zA-Z0-9._-]{1,120}$'),
  add constraint user_my_list_backdrop_path_check check (tmdb_backdrop_path is null or tmdb_backdrop_path ~ '^/[a-zA-Z0-9._-]{1,120}$'),
  add constraint user_my_list_genres_len_check check (cardinality(genres) <= 20),
  add constraint user_my_list_services_len_check check (services is null or cardinality(services) <= 20),
  add constraint user_my_list_popularity_check check (popularity is null or popularity >= 0),
  add constraint user_my_list_vote_count_check check (vote_count is null or vote_count >= 0);

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

-- 3. Princípio do menor privilégio: revoga anon/PUBLIC e permissões DDL/TRUNCATE desnecessárias
revoke all on table public.user_my_list from public, anon, authenticated;
revoke all on table public.user_subscriptions from public, anon, authenticated;

grant select, insert, update, delete on table public.user_my_list to authenticated;
grant select, insert, update, delete on table public.user_subscriptions to authenticated;
