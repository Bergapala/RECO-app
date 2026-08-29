-- RECO — schéma initial : users, recos, friends, reactions
-- + RLS ("chaque utilisateur ne voit que ses données").
--
-- Idempotent : peut être ré-exécuté sans erreur (create ... if not exists,
-- drop policy if exists avant chaque create policy).
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. users — profil applicatif, un-à-un avec auth.users (Supabase Auth)
-- ============================================================================

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  prenom text,
  photo_url text,
  push_token text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own"
  on public.users for delete
  using (auth.uid() = id);

-- Pas de policy INSERT : la ligne est créée automatiquement par le trigger
-- ci-dessous (fonction security definer) à chaque inscription Supabase Auth,
-- jamais directement par le client.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, prenom)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'prenom'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. recos — recommandations postées par un utilisateur
-- ============================================================================

create table if not exists public.recos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  titre text not null,
  url text,
  apercu_image text,
  commentaire text,
  categorie text,
  created_at timestamptz not null default now()
);

create index if not exists recos_user_id_idx on public.recos (user_id);

alter table public.recos enable row level security;

drop policy if exists "recos_select_own" on public.recos;
create policy "recos_select_own"
  on public.recos for select
  using (auth.uid() = user_id);

drop policy if exists "recos_insert_own" on public.recos;
create policy "recos_insert_own"
  on public.recos for insert
  with check (auth.uid() = user_id);

drop policy if exists "recos_update_own" on public.recos;
create policy "recos_update_own"
  on public.recos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recos_delete_own" on public.recos;
create policy "recos_delete_own"
  on public.recos for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 3. friends — demandes / relations d'amitié entre deux utilisateurs
-- ============================================================================

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  friend_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friends_no_self check (user_id <> friend_id),
  constraint friends_unique_pair unique (user_id, friend_id)
);

create index if not exists friends_user_id_idx on public.friends (user_id);
create index if not exists friends_friend_id_idx on public.friends (friend_id);

alter table public.friends enable row level security;

-- Une relation implique deux personnes : chacune des deux doit pouvoir la
-- voir (ex. celui qui reçoit une demande doit voir qu'elle existe).
drop policy if exists "friends_select_involved" on public.friends;
create policy "friends_select_involved"
  on public.friends for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- On ne peut créer une demande qu'en son propre nom.
drop policy if exists "friends_insert_own" on public.friends;
create policy "friends_insert_own"
  on public.friends for insert
  with check (auth.uid() = user_id);

-- Accepter (par le destinataire) ou modifier sa propre demande (par
-- l'émetteur) sont tous deux légitimes.
drop policy if exists "friends_update_involved" on public.friends;
create policy "friends_update_involved"
  on public.friends for update
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "friends_delete_involved" on public.friends;
create policy "friends_delete_involved"
  on public.friends for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- ============================================================================
-- 4. reactions — réactions (like / discovered) sur une reco
-- ============================================================================

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  reco_id uuid not null references public.recos (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('like', 'discovered')),
  created_at timestamptz not null default now(),
  constraint reactions_unique_per_type unique (reco_id, user_id, type)
);

create index if not exists reactions_reco_id_idx on public.reactions (reco_id);
create index if not exists reactions_user_id_idx on public.reactions (user_id);

alter table public.reactions enable row level security;

drop policy if exists "reactions_select_own" on public.reactions;
create policy "reactions_select_own"
  on public.reactions for select
  using (auth.uid() = user_id);

drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own"
  on public.reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "reactions_update_own" on public.reactions;
create policy "reactions_update_own"
  on public.reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own"
  on public.reactions for delete
  using (auth.uid() = user_id);
