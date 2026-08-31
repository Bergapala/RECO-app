-- Trois ajouts au système d'amis :
-- 1. Colonne username (unique, recherche par @pseudo).
-- 2. Notification "X a accepté ta demande" quand une demande passe à
--    accepted (nouveau type 'friend_accepted').
-- Les demandes d'amis EN ATTENTE elles-mêmes ne passent pas par la table
-- notifications : l'écran notifications les lit directement depuis
-- public.friends (status = 'pending'), donc rien à ajouter ici pour ça.
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. username sur public.users
-- ============================================================================

alter table public.users
  add column if not exists username text;

-- Les comptes déjà créés (avant cette migration) n'ont pas de username :
-- on leur en génère un temporaire à partir de leur id, pour satisfaire la
-- contrainte not null ci-dessous sans casser les lignes existantes. Ils
-- pourront le changer plus tard si un écran de modification est ajouté.
update public.users
set username = 'user_' || substr(id::text, 1, 8)
where username is null;

alter table public.users
  alter column username set not null;

-- Format : lettres minuscules, chiffres, underscore, 3 à 20 caractères —
-- pour que la recherche "@pseudo" reste simple (pas d'espace, pas de
-- caractères qui casseraient l'affichage "@username").
alter table public.users
  drop constraint if exists users_username_format_check;
alter table public.users
  add constraint users_username_format_check
  check (username ~ '^[a-z0-9_]{3,20}$');

-- Unicité insensible à la casse (évite "Antoine" et "antoine" en double).
drop index if exists users_username_unique_idx;
create unique index users_username_unique_idx on public.users (lower(username));

-- IMPORTANT : le trigger handle_new_user (voir la toute première migration)
-- insère une ligne public.users à chaque inscription Supabase Auth, sans
-- fournir de username — avec la contrainte not null ci-dessus, ça ferait
-- planter TOUTE inscription. On lui fait donc générer le même placeholder
-- temporaire que le backfill ci-dessus ; l'écran de complétion du profil
-- (src/app/complete-profile.tsx) le remplace ensuite par le vrai choix de
-- l'utilisateur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, prenom, username)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'prenom',
    'user_' || substr(new.id::text, 1, 8)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================================
-- 2. Notification quand une demande d'ami est acceptée
-- ============================================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'new_reco', 'reminder', 'friend_accepted'));

create or replace function public.notify_on_friend_accepted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- new.user_id = l'expéditeur de la demande d'origine, new.friend_id =
  -- la personne qui vient d'accepter (auth.uid() au moment de l'update).
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, type, actor_id)
    values (new.user_id, 'friend_accepted', new.friend_id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_friend_accepted_notify on public.friends;
create trigger on_friend_accepted_notify
  after update on public.friends
  for each row execute function public.notify_on_friend_accepted();
