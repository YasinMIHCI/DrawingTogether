-- DrawingTogether : stockage des toiles partagées (dernière version de chaque salle).
-- À exécuter une fois dans Supabase : tableau de bord du projet → SQL Editor → New query → coller → Run.

-- 1. Bucket privé, fichiers de 15 Mo maximum, seulement des PNG et du JSON
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-canvases', 'shared-canvases', false, 15728640, array['image/png', 'application/json'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Le site (clé publique) peut lire, créer, remplacer et supprimer les fichiers de ce bucket uniquement
drop policy if exists "drawingtogether read" on storage.objects;
drop policy if exists "drawingtogether insert" on storage.objects;
drop policy if exists "drawingtogether update" on storage.objects;
drop policy if exists "drawingtogether delete" on storage.objects;

create policy "drawingtogether read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'shared-canvases');
create policy "drawingtogether insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'shared-canvases');
create policy "drawingtogether update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'shared-canvases') with check (bucket_id = 'shared-canvases');
create policy "drawingtogether delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'shared-canvases');
