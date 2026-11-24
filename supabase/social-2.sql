-- Phase 9 / 10 : Bouille liée au compte, publications texte, compteurs du profil.
-- À lancer une fois dans Supabase → SQL Editor (après social.sql). Peut être relancé sans risque.

-- Bouille (personnage) enregistrée avec le compte : la même sur tous les appareils
alter table public.profiles add column if not exists bouille jsonb;
alter table public.profiles drop constraint if exists profiles_bouille_size;
alter table public.profiles add constraint profiles_bouille_size check (bouille is null or octet_length(bouille::text) <= 4000);
grant update (bouille) on public.profiles to authenticated;

-- Publications : texte seul, dessin seul, ou les deux
alter table public.posts alter column image_path drop not null;
alter table public.posts add column if not exists body text not null default '';
alter table public.posts drop constraint if exists posts_body_len;
alter table public.posts add constraint posts_body_len check (char_length(body) <= 1000);
alter table public.posts drop constraint if exists posts_not_empty;
alter table public.posts add constraint posts_not_empty check (image_path is not null or char_length(trim(body)) > 0);

-- Compteurs visibles sur une page profil (sans révéler la liste des amis)
create or replace function public.profile_stats(uid uuid)
returns table (friends bigint, posts bigint, likes_given bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester = uid or f.addressee = uid)),
    (select count(*) from public.posts p where p.owner_id = uid and public.can_view_post(p.id)),
    (select count(*) from public.post_likes l where l.user_id = uid and public.can_view_post(l.post_id));
$$;
revoke execute on function public.profile_stats(uuid) from public;
grant execute on function public.profile_stats(uuid) to authenticated;

-- Avatars : la mise à jour (upsert) d'un fichier exige aussi le droit de le lire
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects for select to authenticated using (bucket_id = 'avatars');
