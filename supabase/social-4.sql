-- Phase 9 (T9.8) : salons publics par thème, favoris, signalements et modération.
-- À lancer une fois dans Supabase → SQL Editor (après social.sql, social-2.sql et social-3.sql). Peut être relancé sans risque.
--
-- Pour devenir modérateur (remplace « ton_pseudo ») :
--   insert into public.moderators (user_id) select id from public.profiles where username = 'ton_pseudo' on conflict do nothing;

-- ===================== Salons =====================
create table if not exists public.communities (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name_fr text not null,
  name_en text not null,
  desc_fr text not null default '',
  desc_en text not null default '',
  icon text not null default '🎨',
  color text not null default '#5cc43a',
  featured boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.communities enable row level security;
drop policy if exists "communities read" on public.communities;
create policy "communities read" on public.communities for select to authenticated using (true);
grant select on public.communities to authenticated;

insert into public.communities (id, name_fr, name_en, desc_fr, desc_en, icon, color, featured, position) values
  ('defis', 'Défis du moment', 'Current challenges', 'Un thème, tout le monde dessine !', 'One theme, everybody draws!', '🏆', '#f2b630', true, 1),
  ('bouilles', 'Bouilles', 'Bouilles', 'Montre ta Bouille et ses peintures.', 'Show off your Bouille and its face paint.', '🙂', '#ef8fb7', true, 2),
  ('animaux', 'Animaux', 'Animals', 'Chats, chiens, dragons et compagnie.', 'Cats, dogs, dragons and friends.', '🐾', '#8a5a3a', true, 3),
  ('manga', 'Manga & anime', 'Manga & anime', 'Personnages, scènes et styles manga.', 'Characters, scenes and manga styles.', '✨', '#8a5cd6', true, 4),
  ('paysages', 'Paysages', 'Landscapes', 'Nature, villes, mondes imaginaires.', 'Nature, cities, imaginary worlds.', '🏞️', '#3c9a3c', false, 5),
  ('portraits', 'Portraits', 'Portraits', 'Visages, autoportraits, caricatures.', 'Faces, self-portraits, caricatures.', '🧑‍🎨', '#d96f4a', false, 6),
  ('pixel', 'Pixel art', 'Pixel art', 'Un pixel à la fois.', 'One pixel at a time.', '👾', '#2f6fd0', false, 7),
  ('jeux', 'Jeux vidéo', 'Video games', 'Tes jeux préférés en dessin.', 'Your favourite games, drawn.', '🎮', '#2bb3a3', false, 8),
  ('humour', 'Humour', 'Funny', 'Blagues, BD courtes et gribouillages drôles.', 'Jokes, short comics and silly doodles.', '😂', '#f08a2c', false, 9),
  ('gourmandises', 'Gourmandises', 'Food', 'Gâteaux, plats et fruits.', 'Cakes, dishes and fruit.', '🍰', '#e2607f', false, 10),
  ('gribouillis', 'Gribouillis', 'Doodles', 'Pas besoin que ce soit beau !', 'It does not have to be pretty!', '✏️', '#6b7178', false, 11),
  ('aide', 'Conseils & tutos', 'Tips & tutorials', 'Demande de l''aide, partage tes astuces.', 'Ask for help, share your tips.', '💡', '#5cb8e6', false, 12)
on conflict (id) do nothing;

create table if not exists public.community_favorites (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  community_id text not null references public.communities on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, community_id)
);
alter table public.community_favorites enable row level security;
drop policy if exists "favorites own" on public.community_favorites;
create policy "favorites own" on public.community_favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.community_favorites to authenticated;

-- ===================== Modération =====================
create table if not exists public.moderators (
  user_id uuid primary key references public.profiles on delete cascade
);
alter table public.moderators enable row level security;
-- Aucune règle : la table n'est lisible qu'à travers is_moderator()

create or replace function public.is_moderator(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators where user_id = uid);
$$;
grant execute on function public.is_moderator(uuid) to authenticated;

-- Publications : salon facultatif, et « masquée » (par la modération ou après 3 signalements)
alter table public.posts add column if not exists community_id text references public.communities on delete set null;
alter table public.posts add column if not exists hidden boolean not null default false;
create index if not exists posts_community_idx on public.posts (community_id, created_at desc);

-- Seule la modération peut masquer ou rétablir une publication
-- (fonction « invoker » : current_user vaut « postgres » seulement quand le masquage vient du déclencheur des signalements)
create or replace function public.posts_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.hidden := false;
  elsif new.hidden is distinct from old.hidden and not public.is_moderator() and current_user <> 'postgres' then
    new.hidden := old.hidden;
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.posts_guard();

-- Qui peut voir une publication : l'auteur, ses amis, les membres d'une discussion où elle est partagée,
-- tout le monde si elle est dans un salon ; une publication masquée ne reste visible que par l'auteur et la modération.
create or replace function public.can_view_post(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p where p.id = pid and (
      p.owner_id = auth.uid()
      or public.is_moderator()
      or (not p.hidden and (
        public.are_friends(p.owner_id, auth.uid())
        or p.community_id is not null
        or exists (select 1 from public.messages m where m.post_id = pid and public.is_member(m.conversation_id))
      ))
    )
  );
$$;

drop policy if exists "posts moderate" on public.posts;
drop policy if exists "posts delete moderator" on public.posts;
create policy "posts moderate" on public.posts for update to authenticated using (public.is_moderator()) with check (public.is_moderator());
create policy "posts delete moderator" on public.posts for delete to authenticated using (public.is_moderator());
drop policy if exists "comments delete moderator" on public.post_comments;
create policy "comments delete moderator" on public.post_comments for delete to authenticated using (public.is_moderator());
drop policy if exists "posts files delete moderator" on storage.objects;
create policy "posts files delete moderator" on storage.objects for delete to authenticated using (bucket_id = 'posts' and public.is_moderator());

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts on delete cascade,
  reporter uuid not null default auth.uid() references public.profiles on delete cascade,
  reason text not null check (reason in ('spam', 'offensive', 'other')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter)
);
alter table public.reports enable row level security;
drop policy if exists "reports add" on public.reports;
drop policy if exists "reports moderate read" on public.reports;
drop policy if exists "reports moderate delete" on public.reports;
create policy "reports add" on public.reports for insert to authenticated with check (reporter = auth.uid() and public.can_view_post(post_id));
create policy "reports moderate read" on public.reports for select to authenticated using (public.is_moderator());
create policy "reports moderate delete" on public.reports for delete to authenticated using (public.is_moderator());
grant select, insert, delete on public.reports to authenticated;

-- 3 signalements : la publication est masquée en attendant la modération
create or replace function public.on_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where post_id = new.post_id) >= 3 then
    update public.posts set hidden = true where id = new.post_id;
  end if;
  return new;
end $$;
drop trigger if exists reports_hide on public.reports;
create trigger reports_hide after insert on public.reports for each row execute function public.on_report();
