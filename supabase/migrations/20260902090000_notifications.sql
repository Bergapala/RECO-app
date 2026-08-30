-- Écran Notifications + préférences (écran Paramètres).
--
-- Les notifications ne sont JAMAIS insérées par le client : elles sont
-- créées par des triggers `security definer` (comme handle_new_user dans
-- la toute première migration), qui contournent RLS pour écrire une notif
-- au bon destinataire. Le client, lui, ne peut que lire et marquer comme
-- lues SES PROPRES notifications — voir les policies plus bas.
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. Préférences de notification (nouvelles colonnes sur users)
-- ============================================================================

-- notif_day : 0 = lundi ... 6 = dimanche.
-- notif_hour : un des creneaux 8-10, 12-14, 16-18, 20-22.
-- Contraintes definies directement sur la colonne (inline) plutot que via
-- des ALTER TABLE ADD CONSTRAINT separes.
alter table public.users
  add column if not exists notif_enabled boolean not null default true,
  add column if not exists notif_day smallint check (notif_day between 0 and 6),
  add column if not exists notif_hour text check (notif_hour in ('8-10', '12-14', '16-18', '20-22')),
  add column if not exists notif_reactions boolean not null default true,
  add column if not exists notif_new_recos boolean not null default true;

-- ============================================================================
-- 2. Table notifications
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade, -- destinataire
  type text not null check (type in ('like', 'new_reco', 'reminder')),
  actor_id uuid references public.users (id) on delete cascade, -- qui a déclenché (null pour reminder)
  reco_id uuid references public.recos (id) on delete cascade, -- reco concernée (null pour reminder)
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, read);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Pas de policy insert/delete pour les utilisateurs : seuls les triggers
-- ci-dessous créent des notifications, avec les privilèges du propriétaire
-- de la fonction (contourne RLS), jamais le client directement.

-- Realtime, pour que le badge de la cloche se mette à jour en direct.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ============================================================================
-- 3. Trigger : notifie l’auteur quand quelqu’un like sa reco (pas lui-même)
-- ============================================================================

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  reco_owner uuid;
  owner_wants_notif boolean;
begin
  if new.type <> 'like' then
    return new;
  end if;

  select user_id into reco_owner from public.recos where id = new.reco_id;

  if reco_owner is null or reco_owner = new.user_id then
    return new; -- pas de notif si on like sa propre reco
  end if;

  select coalesce(notif_enabled, true) and coalesce(notif_reactions, true)
    into owner_wants_notif
    from public.users
    where id = reco_owner;

  if coalesce(owner_wants_notif, true) then
    insert into public.notifications (user_id, type, actor_id, reco_id)
    values (reco_owner, 'like', new.user_id, new.reco_id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_reaction_like_notify on public.reactions;
create trigger on_reaction_like_notify
  after insert on public.reactions
  for each row execute function public.notify_on_like();

-- ============================================================================
-- 4. Trigger : notifie chaque ami accepté quand quelqu’un poste une reco
-- ============================================================================

create or replace function public.notify_on_new_reco()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id, reco_id)
  select
    recipient.id,
    'new_reco',
    new.user_id,
    new.id
  from public.friends f
  join public.users recipient
    on recipient.id = case when f.user_id = new.user_id then f.friend_id else f.user_id end
  where f.status = 'accepted'
    and (f.user_id = new.user_id or f.friend_id = new.user_id)
    and coalesce(recipient.notif_enabled, true)
    and coalesce(recipient.notif_new_recos, true);

  return new;
end;
$$;

drop trigger if exists on_reco_new_notify on public.recos;
create trigger on_reco_new_notify
  after insert on public.recos
  for each row execute function public.notify_on_new_reco();

-- ============================================================================
-- Remarque : les notifications de type reminder (rappel hebdomadaire, pas
-- posté depuis une semaine) ne sont pas créées par cette migration. Il n’y
-- a ici aucune tâche planifiée : rien ne tourne tout seul dans le temps
-- côté Postgres/Supabase sans un cron. Générer ce rappel automatiquement,
-- au jour et à l’heure choisis par chaque utilisateur (notif_day et
-- notif_hour), nécessite un job planifié (pg_cron) — voir le résumé
-- transmis par Claude pour les prochaines étapes si besoin.
-- ============================================================================
