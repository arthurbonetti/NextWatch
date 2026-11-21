update public.user_profiles
set avatar_type = 'initials',
    avatar_preset = null,
    updated_at = timezone('utc'::text, now())
where avatar_preset = 'clockwork-orange';

alter table public.user_profiles
  drop constraint if exists user_profiles_avatar_preset_check;

alter table public.user_profiles
  add constraint user_profiles_avatar_preset_check check (
    avatar_preset is null
    or avatar_preset in (
      'matrix',
      'kill-bill',
      'godfather',
      'batman',
      'interstellar',
      'jurassic',
      'naruto',
      'fullmetal'
    )
  );
