-- Colonne telephone (synchro contacts) + code d'invitation unique par
-- utilisateur, avec redemption automatique du code a l'inscription (dans
-- le meme trigger que la creation du profil, donc atomique et fiable meme
-- si la confirmation email est activee sur le projet).
--
-- A executer dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. Colonne phone (nullable, format libre)
-- ============================================================================

alter table public.users
  add column if not exists phone text;

-- ============================================================================
-- 2. Colonne invite_code, generee automatiquement (defaut aleatoire),
--    unique. Pour les lignes deja existantes, Postgres calcule une valeur
--    distincte par ligne car random() est une expression volatile.
-- ============================================================================

alter table public.users
  add column if not exists invite_code text;

update public.users
  set invite_code = upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
  where invite_code is null;

alter table public.users
  alter column invite_code set default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

alter table public.users
  alter column invite_code set not null;

drop index if exists users_invite_code_unique_idx;
create unique index users_invite_code_unique_idx on public.users (invite_code);

-- ============================================================================
-- 3. handle_new_user (definie dans la toute premiere migration) etendue :
--    - enregistre phone en plus de prenom, si fourni a l'inscription.
--    - si un invite_code est fourni et correspond a un utilisateur existant,
--      cree directement une amitie status=accepted entre les deux (pas de
--      pending -> accepted, l'invitation vaut acceptation immediate).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  inviter_id uuid;
  submitted_code text;
begin
  insert into public.users (id, email, prenom, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'prenom',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;

  submitted_code := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');

  if submitted_code is not null then
    select id into inviter_id
      from public.users
      where invite_code = upper(submitted_code)
        and id <> new.id;

    if inviter_id is not null then
      insert into public.friends (user_id, friend_id, status)
      values (new.id, inviter_id, 'accepted')
      on conflict (user_id, friend_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;
