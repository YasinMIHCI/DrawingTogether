-- Phase 9 (T9.7) : notifications (demandes d'ami, amitiés acceptées, « Ouais ! », commentaires, ajout à un groupe).
-- À lancer une fois dans Supabase → SQL Editor (après social.sql et social-2.sql). Peut être relancé sans risque.

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,   -- destinataire
  actor_id uuid not null references public.profiles on delete cascade,  -- qui a fait l'action
  kind text not null check (kind in ('friend_request', 'friend_accept', 'like', 'comment', 'group_add')),
  post_id uuid references public.posts on delete cascade,
  conversation_id uuid references public.conversations on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "notifications read own" on public.notifications;
drop policy if exists "notifications update own" on public.notifications;
drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications read own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications update own" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications delete own" on public.notifications for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

-- Création des notifications (les déclencheurs passent outre les règles RLS)
create or replace function public.notify(target uuid, actor uuid, k text, post uuid default null, conv uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target is null or actor is null or target = actor then return; end if;
  -- Pas de doublon pour un même « Ouais ! » retiré puis remis
  if k = 'like' and exists (select 1 from public.notifications n where n.user_id = target and n.actor_id = actor and n.kind = 'like' and n.post_id = post) then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, kind, post_id, conversation_id) values (target, actor, k, post, conv);
end $$;
revoke execute on function public.notify(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.on_friendship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(new.addressee, new.requester, 'friend_request');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    perform public.notify(new.requester, new.addressee, 'friend_accept');
    delete from public.notifications where user_id = new.addressee and actor_id = new.requester and kind = 'friend_request';
  end if;
  return new;
end $$;
drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify after insert or update on public.friendships for each row execute function public.on_friendship();

create or replace function public.on_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select owner_id from public.posts where id = new.post_id), new.user_id, 'like', new.post_id);
  return new;
end $$;
drop trigger if exists likes_notify on public.post_likes;
create trigger likes_notify after insert on public.post_likes for each row execute function public.on_like();

create or replace function public.on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select owner_id from public.posts where id = new.post_id), new.user_id, 'comment', new.post_id);
  return new;
end $$;
drop trigger if exists comments_notify on public.post_comments;
create trigger comments_notify after insert on public.post_comments for each row execute function public.on_comment();

create or replace function public.on_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select kind from public.conversations where id = new.conversation_id) = 'group' then
    perform public.notify(new.user_id, auth.uid(), 'group_add', null, new.conversation_id);
  end if;
  return new;
end $$;
drop trigger if exists members_notify on public.conversation_members;
create trigger members_notify after insert on public.conversation_members for each row execute function public.on_member();

-- Notifications en direct
do $$ begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end $$;
