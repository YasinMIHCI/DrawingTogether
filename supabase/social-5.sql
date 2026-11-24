-- Défis de la semaine et humeurs des publications.
-- À lancer une fois dans Supabase → SQL Editor (après les scripts social*.sql précédents). Peut être relancé sans risque.

-- Semaine du défi (ex. « 2026-W48 ») : le thème correspondant est choisi par le site
alter table public.posts add column if not exists challenge text;
alter table public.posts drop constraint if exists posts_challenge_format;
alter table public.posts add constraint posts_challenge_format check (challenge is null or challenge ~ '^[0-9]{4}-W[0-9]{2}$');
create index if not exists posts_challenge_idx on public.posts (challenge, created_at desc) where challenge is not null;

-- Humeur choisie en publiant : la Bouille de l'auteur prend cette expression
alter table public.posts add column if not exists mood text;
alter table public.posts drop constraint if exists posts_mood_values;
alter table public.posts add constraint posts_mood_values check (mood is null or mood in ('neutral', 'happy', 'surprised', 'sad', 'angry', 'wink'));
