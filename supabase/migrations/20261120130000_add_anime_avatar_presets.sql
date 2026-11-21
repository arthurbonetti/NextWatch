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
      'clockwork-orange',
      'interstellar',
      'jurassic',
      'naruto',
      'fullmetal'
    )
  );
