-- Tabela de perfil do usuário (nome de exibição e ícone/foto de perfil)
-- e bucket de Storage `avatars` com RLS estrita por pasta do usuário.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  avatar_type text not null default 'initials' check (avatar_type in ('initials', 'preset', 'custom')),
  avatar_preset text check (
    avatar_preset is null
    or avatar_preset in (
      'matrix',
      'kill-bill',
      'godfather',
      'batman',
      'clockwork-orange',
      'interstellar',
      'jurassic'
    )
  ),
  avatar_path text check (
    avatar_path is null
    or (
      char_length(avatar_path) between 3 and 256
      and avatar_path ~ '^[0-9a-fA-F-]{36}/avatar-[0-9a-zA-Z_-]+\.(jpg|jpeg|png|webp)$'
    )
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint user_profiles_avatar_consistency_check check (
    (avatar_type = 'initials' and avatar_preset is null and avatar_path is null)
    or (avatar_type = 'preset' and avatar_preset is not null and avatar_path is null)
    or (avatar_type = 'custom' and avatar_preset is null and avatar_path is not null)
  )
);

-- Backfill seguro para contas existentes em auth.users
insert into public.user_profiles (user_id, display_name)
select
  u.id,
  case
    when char_length(btrim(coalesce(u.raw_user_meta_data->>'name', ''))) >= 2
      then left(btrim(u.raw_user_meta_data->>'name'), 80)
    when char_length(btrim(coalesce(split_part(coalesce(u.email, ''), '@', 1), ''))) >= 2
      then left(btrim(split_part(u.email, '@', 1)), 80)
    else 'Usuário'
  end
from auth.users u
on conflict (user_id) do nothing;

alter table public.user_profiles enable row level security;

revoke all on table public.user_profiles from public, anon, authenticated;
grant select, insert, update on table public.user_profiles to authenticated;

drop policy if exists "Users can view their own profile" on public.user_profiles;
create policy "Users can view their own profile"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own profile" on public.user_profiles;
create policy "Users can insert their own profile"
  on public.user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Bucket público de leitura direta (por URL exata) com limite de 5 MB e tipos restritos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS em storage.objects restrita à pasta <auth.uid()>/ do próprio usuário (sem listar bucket público)
drop policy if exists "Users can view their own avatar files" on storage.objects;
create policy "Users can view their own avatar files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can upload their own avatar files" on storage.objects;
create policy "Users can upload their own avatar files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own avatar files" on storage.objects;
create policy "Users can update their own avatar files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own avatar files" on storage.objects;
create policy "Users can delete their own avatar files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
