-- DrawingTogether : comptes et réseau social (amis, discussions, groupes, dessins partagés).
-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.
-- Ré-exécutable sans risque (les objets existants sont mis à jour).

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ===================== Profils =====================
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username extensions.citext not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Le profil est créé automatiquement à l'inscription (pseudo passé dans les métadonnées)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, lower(new.raw_user_meta_data->>'username'), coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.username_available(uname text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(uname));
$$;

-- ===================== Mot de passe oublié : question secrète =====================
create table if not exists public.account_recovery (
  user_id uuid primary key references auth.users on delete cascade,
  question text not null,
  answer_hash text not null,
  failed int not null default 0,
  locked_until timestamptz
);
alter table public.account_recovery enable row level security; -- aucun accès direct : seulement les fonctions ci-dessous

create or replace function public.set_recovery(question text, answer text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(trim(question)) < 3 or char_length(trim(answer)) < 1 then raise exception 'invalid question or answer'; end if;
  insert into public.account_recovery (user_id, question, answer_hash)
  values (auth.uid(), left(trim(question), 200), crypt(lower(trim(answer)), gen_salt('bf')))
  on conflict (user_id) do update set question = excluded.question, answer_hash = excluded.answer_hash, failed = 0, locked_until = null;
end $$;

create or replace function public.recovery_question(uname text) returns text
language sql stable security definer set search_path = public as $$
  select r.question from public.account_recovery r join public.profiles p on p.id = r.user_id where p.username = lower(uname);
$$;

-- Renvoie 'ok', 'wrong', 'locked', 'unknown' ou 'weak'. 5 mauvaises réponses = blocage 15 minutes.
create or replace function public.reset_password(uname text, answer text, new_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare rec record;
begin
  select r.user_id, r.answer_hash, r.failed, r.locked_until into rec
  from public.account_recovery r join public.profiles p on p.id = r.user_id
  where p.username = lower(uname) for update of r;
  if not found then return 'unknown'; end if;
  if rec.locked_until is not null and rec.locked_until > now() then return 'locked'; end if;
  if char_length(coalesce(new_password, '')) < 8 then return 'weak'; end if;
  if rec.answer_hash = crypt(lower(trim(answer)), rec.answer_hash) then
    update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now() where id = rec.user_id;
    update public.account_recovery set failed = 0, locked_until = null where user_id = rec.user_id;
    return 'ok';
  end if;
  if rec.failed + 1 >= 5 then
    update public.account_recovery set failed = 0, locked_until = now() + interval '15 minutes' where user_id = rec.user_id;
    return 'locked';
  end if;
  update public.account_recovery set failed = rec.failed + 1 where user_id = rec.user_id;
  return 'wrong';
end $$;

-- ===================== Amis =====================
create table if not exists public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
drop policy if exists "friendships read" on public.friendships;
drop policy if exists "friendships request" on public.friendships;
drop policy if exists "friendships accept" on public.friendships;
drop policy if exists "friendships delete" on public.friendships;
create policy "friendships read" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy "friendships request" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy "friendships accept" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy "friendships delete" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where status = 'accepted'
    and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;

-- ===================== Dessins partagés =====================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  image_path text not null,
  width int not null default 0,
  height int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

-- ===================== Discussions (privées et groupes) =====================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  name text not null default '' check (char_length(name) <= 60),
  avatar_url text,
  direct_key text unique,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  post_id uuid references public.posts on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv on public.messages (conversation_id, created_at desc);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_member(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = conv and user_id = auth.uid());
$$;

create or replace function public.is_owner(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = conv and user_id = auth.uid() and role = 'owner');
$$;

-- Écrire : être membre ; en privé, il faut être encore amis.
create or replace function public.can_send(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(conv) and (
    (select kind from public.conversations where id = conv) = 'group'
    or exists (select 1 from public.conversation_members m where m.conversation_id = conv and m.user_id <> auth.uid()
               and public.are_friends(auth.uid(), m.user_id))
  );
$$;

drop policy if exists "conversations read" on public.conversations;
drop policy if exists "conversations rename" on public.conversations;
create policy "conversations read" on public.conversations for select to authenticated using (public.is_member(id));
create policy "conversations rename" on public.conversations for update to authenticated
  using (kind = 'group' and public.is_member(id)) with check (kind = 'group' and public.is_member(id));

drop policy if exists "members read" on public.conversation_members;
drop policy if exists "members mark read" on public.conversation_members;
drop policy if exists "members leave" on public.conversation_members;
create policy "members read" on public.conversation_members for select to authenticated using (public.is_member(conversation_id));
create policy "members mark read" on public.conversation_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members leave" on public.conversation_members for delete to authenticated using (
  user_id = auth.uid() or public.is_owner(conversation_id)
);

drop policy if exists "messages read" on public.messages;
drop policy if exists "messages send" on public.messages;
drop policy if exists "messages delete own" on public.messages;
create policy "messages read" on public.messages for select to authenticated using (public.is_member(conversation_id));
create policy "messages send" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.can_send(conversation_id));
create policy "messages delete own" on public.messages for delete to authenticated using (sender_id = auth.uid());

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists messages_touch on public.messages;
create trigger messages_touch after insert on public.messages for each row execute function public.touch_conversation();

-- Ouvre (ou crée) la discussion privée avec un ami
create or replace function public.open_direct(friend uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k text; conv uuid;
begin
  if not public.are_friends(auth.uid(), friend) then raise exception 'not friends'; end if;
  k := least(auth.uid()::text, friend::text) || ':' || greatest(auth.uid()::text, friend::text);
  select id into conv from public.conversations where direct_key = k;
  if conv is null then
    insert into public.conversations (kind, direct_key, created_by) values ('direct', k, auth.uid()) returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, auth.uid()), (conv, friend);
  end if;
  return conv;
end $$;

-- Crée un groupe avec des amis (50 membres max)
create or replace function public.create_group(group_name text, members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare conv uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if coalesce(array_length(members, 1), 0) > 49 then raise exception 'too many members'; end if;
  insert into public.conversations (kind, name, created_by) values ('group', left(trim(group_name), 60), auth.uid()) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, auth.uid(), 'owner');
  foreach m in array coalesce(members, '{}') loop
    if m <> auth.uid() and public.are_friends(auth.uid(), m) then
      insert into public.conversation_members (conversation_id, user_id) values (conv, m) on conflict do nothing;
    end if;
  end loop;
  return conv;
end $$;

-- Un membre du groupe peut y ajouter ses propres amis
create or replace function public.add_group_members(conv uuid, members uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if not public.is_member(conv) or (select kind from public.conversations where id = conv) <> 'group' then raise exception 'not allowed'; end if;
  if (select count(*) from public.conversation_members where conversation_id = conv) + coalesce(array_length(members, 1), 0) > 50 then
    raise exception 'too many members';
  end if;
  foreach m in array coalesce(members, '{}') loop
    if public.are_friends(auth.uid(), m) then
      insert into public.conversation_members (conversation_id, user_id) values (conv, m) on conflict do nothing;
    end if;
  end loop;
end $$;

-- Mes discussions : dernier message, non lus, et l'autre personne pour les discussions privées
create or replace function public.my_conversations()
returns table (id uuid, kind text, name text, avatar_url text, updated_at timestamptz, last_body text, last_post uuid,
               last_sender uuid, unread bigint, other_id uuid)
language sql stable security invoker set search_path = public as $$
  select c.id, c.kind, c.name, c.avatar_url, c.updated_at,
    lm.body, lm.post_id, lm.sender_id,
    (select count(*) from public.messages x where x.conversation_id = c.id and x.created_at > me.last_read_at and x.sender_id <> auth.uid()),
    (select o.user_id from public.conversation_members o where o.conversation_id = c.id and o.user_id <> auth.uid() limit 1)
  from public.conversations c
  join public.conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid()
  left join lateral (select body, post_id, sender_id from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  order by c.updated_at desc;
$$;

-- ===================== Visibilité des dessins, likes, commentaires =====================
create or replace function public.can_view_post(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p where p.id = pid and (
      p.owner_id = auth.uid()
      or public.are_friends(p.owner_id, auth.uid())
      or exists (select 1 from public.messages m where m.post_id = pid and public.is_member(m.conversation_id))
    )
  );
$$;

drop policy if exists "posts read" on public.posts;
drop policy if exists "posts create" on public.posts;
drop policy if exists "posts update own" on public.posts;
drop policy if exists "posts delete own" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (public.can_view_post(id));
create policy "posts create" on public.posts for insert to authenticated with check (owner_id = auth.uid());
create policy "posts update own" on public.posts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (owner_id = auth.uid());

create table if not exists public.post_likes (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.post_comments (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
drop policy if exists "likes read" on public.post_likes;
drop policy if exists "likes add" on public.post_likes;
drop policy if exists "likes remove" on public.post_likes;
create policy "likes read" on public.post_likes for select to authenticated using (public.can_view_post(post_id));
create policy "likes add" on public.post_likes for insert to authenticated with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy "likes remove" on public.post_likes for delete to authenticated using (user_id = auth.uid());
drop policy if exists "comments read" on public.post_comments;
drop policy if exists "comments add" on public.post_comments;
drop policy if exists "comments delete" on public.post_comments;
create policy "comments read" on public.post_comments for select to authenticated using (public.can_view_post(post_id));
create policy "comments add" on public.post_comments for insert to authenticated with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy "comments delete" on public.post_comments for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.owner_id = auth.uid())
);

-- ===================== Droits d'exécution =====================
revoke execute on function public.username_available(text), public.recovery_question(text), public.reset_password(text, text, text) from public;
grant execute on function public.username_available(text), public.recovery_question(text), public.reset_password(text, text, text) to anon, authenticated;
revoke execute on function public.set_recovery(text, text), public.open_direct(uuid), public.create_group(text, uuid[]),
  public.add_group_members(uuid, uuid[]), public.my_conversations(), public.are_friends(uuid, uuid), public.is_member(uuid), public.is_owner(uuid),
  public.can_send(uuid), public.can_view_post(uuid) from public, anon;
grant execute on function public.set_recovery(text, text), public.open_direct(uuid), public.create_group(text, uuid[]),
  public.add_group_members(uuid, uuid[]), public.my_conversations(), public.are_friends(uuid, uuid), public.is_member(uuid), public.is_owner(uuid),
  public.can_send(uuid), public.can_view_post(uuid) to authenticated;

-- ===================== Stockage : avatars (publics) et dessins partagés (privés) =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('posts', 'posts', false, 8388608, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars write own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;
drop policy if exists "avatars delete own" on storage.objects;
drop policy if exists "posts upload own" on storage.objects;
drop policy if exists "posts read visible" on storage.objects;
drop policy if exists "posts delete own" on storage.objects;
create policy "avatars write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "posts upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "posts read visible" on storage.objects for select to authenticated using (
  bucket_id = 'posts' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.posts p where p.image_path = storage.objects.name and public.can_view_post(p.id))
  )
);
create policy "posts delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===================== Temps réel (nouveaux messages, demandes d'amis) =====================
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.friendships; exception when duplicate_object then null; end;
end $$;
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
