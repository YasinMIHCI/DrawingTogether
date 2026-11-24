-- Accès aux tables du réseau social pour les comptes connectés.
-- (Les projets Supabase récents n'exposent plus automatiquement les nouvelles tables.)
-- Les règles RLS de social.sql limitent ensuite ce que chacun peut voir ou modifier.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, bio, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, update on public.conversations to authenticated;
grant select, update, delete on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, delete on public.post_comments to authenticated;
grant usage on all sequences in schema public to authenticated;
