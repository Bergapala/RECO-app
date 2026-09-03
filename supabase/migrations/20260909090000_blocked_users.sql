-- Blocage d'utilisateurs (conformité Apple — App Store Review Guideline 1.2
-- "Safety" : les apps avec du contenu généré par les utilisateurs doivent
-- permettre de bloquer un autre utilisateur, pas seulement de signaler du
-- contenu). Voir src/app/profile/[id].tsx (bloquer) et src/app/settings.tsx
-- (liste + débloquer).
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. blocked_users — un blocage = blocker_id ne veut plus voir blocked_id
--    (ni être vu par lui). La policy SELECT ci-dessous autorise les DEUX
--    côtés à lire une ligne qui les concerne (comme "friends_select_involved"
--    sur la table friends) : c'est ce qui permet à getBlockedUserIds() de
--    calculer, pour n'importe quel utilisateur, la liste complète des ids à
--    exclure de son propre feed/recherche — que ce soit lui qui ait bloqué,
--    ou lui qui ait été bloqué (voir src/lib/blocks.ts).
-- ============================================================================

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self check (blocker_id <> blocked_id),
  constraint blocked_users_unique_pair unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_id_idx on public.blocked_users (blocker_id);
create index if not exists blocked_users_blocked_id_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_involved" on public.blocked_users;
create policy "blocked_users_select_involved"
  on public.blocked_users for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "blocked_users_insert_own" on public.blocked_users;
create policy "blocked_users_insert_own"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "blocked_users_delete_own" on public.blocked_users;
create policy "blocked_users_delete_own"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- ============================================================================
-- 2. Trigger — un blocage supprime automatiquement la relation d'amitié
--    existante entre les deux utilisateurs (peu importe qui avait envoyé la
--    demande à l'origine, et peu importe si elle était "pending" ou déjà
--    "accepted").
-- ============================================================================

create or replace function public.remove_friendship_after_block()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.friends
  where (user_id = new.blocker_id and friend_id = new.blocked_id)
     or (user_id = new.blocked_id and friend_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists on_block_created on public.blocked_users;
create trigger on_block_created
  after insert on public.blocked_users
  for each row execute function public.remove_friendship_after_block();

-- ============================================================================
-- 3. Trigger — empêche l'envoi d'une demande d'ami entre deux utilisateurs
--    dont l'un a bloqué l'autre (défense en profondeur : la recherche
--    d'amis exclut déjà les utilisateurs bloqués côté client, voir
--    src/lib/friends.ts, mais ceci protège aussi un appel direct à l'API).
-- ============================================================================

create or replace function public.prevent_friend_request_if_blocked()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = new.user_id and blocked_id = new.friend_id)
       or (blocker_id = new.friend_id and blocked_id = new.user_id)
  ) then
    raise exception 'Impossible d''envoyer une demande d''ami : un blocage existe entre ces deux utilisateurs.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_blocked_friend_request on public.friends;
create trigger prevent_blocked_friend_request
  before insert on public.friends
  for each row execute function public.prevent_friend_request_if_blocked();
