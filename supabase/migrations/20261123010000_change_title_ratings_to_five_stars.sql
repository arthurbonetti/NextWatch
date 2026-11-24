-- Converte avaliações pessoais existentes da escala 0–10 para 0–5 estrelas.

alter table public.user_title_ratings
  drop constraint if exists user_title_ratings_rating_check;

update public.user_title_ratings
set rating = least(5, greatest(0, round(rating::numeric / 2)))::smallint,
    updated_at = timezone('utc'::text, now())
where rating > 5;

alter table public.user_title_ratings
  add constraint user_title_ratings_rating_check
  check (rating between 0 and 5);
