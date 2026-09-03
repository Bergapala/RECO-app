-- Nouvelles préférences pour la refonte de l'écran Paramètres — voir
-- src/app/settings/notifications.tsx et src/app/settings/privacy/index.tsx.
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

alter table public.users
  add column if not exists notif_comments boolean not null default true,
  add column if not exists notif_friend_requests boolean not null default true,
  add column if not exists privacy_show_friends_to_friends boolean not null default true,
  add column if not exists privacy_findable_by_phone boolean not null default true;

comment on column public.users.notif_comments is
  'Notifier des nouveaux commentaires sur mes recos.';
comment on column public.users.notif_friend_requests is
  'Notifier des nouvelles demandes d''amis.';
comment on column public.users.privacy_show_friends_to_friends is
  'Autoriser mes amis à voir ma liste d''amis.';
comment on column public.users.privacy_findable_by_phone is
  'Apparaître dans les résultats de synchronisation de contacts des autres utilisateurs (voir findContactsOnReco, src/lib/contacts.ts).';

-- Aucune policy RLS supplémentaire nécessaire : "users_update_own"
-- (migration create_reco_tables) couvre déjà l'écriture de toute la ligne,
-- et "users_select_authenticated" (migration users_searchable) couvre
-- déjà la lecture par n'importe quel utilisateur authentifié — nécessaire
-- pour que findContactsOnReco puisse lire privacy_findable_by_phone sur
-- les AUTRES utilisateurs, exactement comme pour notif_reactions etc.
