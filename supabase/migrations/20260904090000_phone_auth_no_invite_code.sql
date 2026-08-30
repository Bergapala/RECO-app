-- Retire completement l'idee de code de parrainage (migration precedente
-- 20260903090000_phone_invite_code.sql) et branche a la place le
-- telephone natif de Supabase Auth (connexion par OTP SMS), en plus de la
-- possibilite de le renseigner a la main depuis l'ecran Completion de
-- profil.
--
-- Ecrite pour etre re-jouable que la migration precedente ait ete
-- executee ou non (tout est "if exists").
--
-- A executer dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. Retrait du code de parrainage
-- ============================================================================

drop index if exists users_invite_code_unique_idx;

alter table public.users
  drop column if exists invite_code;

-- ============================================================================
-- 1bis. email doit devenir nullable : un compte cree par OTP SMS n'a pas
--       forcement d'email (auth.users.email serait NULL), et la ligne
--       handle_new_user echouerait sinon (email etait "not null" depuis la
--       toute premiere migration). Reste unique quand renseigne.
-- ============================================================================

alter table public.users
  alter column email drop not null;

-- ============================================================================
-- 2. Colonne phone : nullable, mais unique quand elle est renseignee
--    (deux NULL ne sont jamais consideres egaux par une contrainte unique
--    Postgres, donc plusieurs comptes peuvent rester sans telephone).
-- ============================================================================

alter table public.users
  add column if not exists phone text;

drop index if exists users_phone_unique_idx;
create unique index users_phone_unique_idx on public.users (phone) where phone is not null;

-- ============================================================================
-- 3. handle_new_user etendue : le telephone peut venir soit du champ natif
--    auth.users.phone (inscription par OTP SMS, confirme par Supabase Auth
--    lui-meme), soit des metadonnees (inscription par email, telephone
--    ajoute a la main sur l'ecran Completion de profil). Le code de
--    parrainage est totalement retire de cette fonction.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, prenom, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'prenom',
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
