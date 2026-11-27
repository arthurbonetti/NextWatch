-- Índice de cobertura por título e tabela agregada de médias de avaliação dos usuários,
-- mantida por trigger privada sem expor notas individuais de outros usuários.

create schema if not exists private;

create index if not exists idx_user_title_ratings_title_id
  on public.user_title_ratings (title_id)
  include (rating);

create table if not exists public.title_rating_stats (
  title_id text primary key check (char_length(title_id) between 1 and 128),
  rating_sum bigint not null default 0 check (rating_sum >= 0),
  rating_count integer not null default 0 check (rating_count >= 0),
  average_rating numeric(3, 2) generated always as (
    case
      when rating_count > 0 then round((rating_sum::numeric / rating_count), 2)
      else 0
    end
  ) stored,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.title_rating_stats enable row level security;

grant select on table public.title_rating_stats to authenticated;

create policy "Authenticated users can view title rating stats"
  on public.title_rating_stats
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create or replace function private.apply_title_rating_delta(
  p_title_id text,
  p_sum_delta bigint,
  p_count_delta integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_title_id is null or char_length(p_title_id) = 0 then
    return;
  end if;

  insert into public.title_rating_stats (title_id, rating_sum, rating_count, updated_at)
  values (
    p_title_id,
    greatest(0::bigint, p_sum_delta),
    greatest(0, p_count_delta),
    timezone('utc'::text, now())
  )
  on conflict (title_id) do update set
    rating_sum = greatest(0::bigint, public.title_rating_stats.rating_sum + p_sum_delta),
    rating_count = greatest(0, public.title_rating_stats.rating_count + p_count_delta),
    updated_at = timezone('utc'::text, now());
end;
$$;

create or replace function private.sync_title_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.apply_title_rating_delta(new.title_id, new.rating::bigint, 1);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.title_id = old.title_id then
      if new.rating <> old.rating then
        perform private.apply_title_rating_delta(
          new.title_id,
          (new.rating - old.rating)::bigint,
          0
        );
      end if;
    else
      perform private.apply_title_rating_delta(old.title_id, -(old.rating::bigint), -1);
      perform private.apply_title_rating_delta(new.title_id, new.rating::bigint, 1);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform private.apply_title_rating_delta(old.title_id, -(old.rating::bigint), -1);
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_sync_title_rating_stats
  after insert or update or delete on public.user_title_ratings
  for each row
  execute function private.sync_title_rating_stats();

insert into public.title_rating_stats (title_id, rating_sum, rating_count, updated_at)
select
  title_id,
  sum(rating)::bigint,
  count(*)::integer,
  timezone('utc'::text, now())
from public.user_title_ratings
group by title_id
on conflict (title_id) do update set
  rating_sum = excluded.rating_sum,
  rating_count = excluded.rating_count,
  updated_at = excluded.updated_at;
