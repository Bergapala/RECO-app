-- Sécurité — restreint la lecture des colonnes sensibles de public.users
-- (phone, push_token). La policy RLS "users_select_authenticated"
-- (migration users_searchable, using (true)) reste nécessaire telle
-- quelle : RLS est un mécanisme par LIGNE, pas par colonne, et cette
-- policy permissive est ce qui permet à toutes les autres colonnes
-- (prenom, photo_url, username, streak_count...) de rester lisibles par
-- tout le monde — indispensable pour les jointures users(...) utilisées
-- partout (auteur d'une reco, d'un commentaire, d'une notification,
-- recherche d'amis...). On ajoute ici des privilèges au niveau COLONNE,
-- qui se combinent avec RLS plutôt que de la remplacer, pour retirer
-- spécifiquement phone/push_token de ce qui est lisible par tout
-- utilisateur authentifié.
--
-- Conséquence : plus aucune requête directe (y compris pour sa propre
-- ligne) ne peut sélectionner phone/push_token — voir les deux fonctions
-- security definer ci-dessous pour les deux seuls usages légitimes
-- restants (vérifier qu'on a soi-même un numéro enregistré, et faire
-- correspondre les contacts du téléphone à des comptes RECO), qui
-- contournent volontairement ce verrou sans jamais renvoyer le numéro
-- lui-même au client.
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

revoke select (phone, push_token) on public.users from authenticated;
revoke select (phone, push_token) on public.users from anon;

-- ============================================================================
-- 1. "Ai-je déjà un numéro enregistré ?" (voir src/app/complete-profile.tsx,
--    hasExistingPhone) — un booléen suffit, jamais le numéro lui-même.
--    Strictement borné à auth.uid() : impossible de l'appeler pour
--    quelqu'un d'autre.
-- ============================================================================

create or replace function public.current_user_has_phone()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and phone is not null
  );
$$;

grant execute on function public.current_user_has_phone() to authenticated;

-- ============================================================================
-- 2. Synchronisation des contacts (voir src/lib/contacts.ts,
--    findContactsOnReco) — la comparaison numéro-par-numéro se fait
--    désormais côté base plutôt que de télécharger le numéro de tout le
--    monde vers le client pour comparer localement : plus sûr (aucun
--    numéro ne transite jamais côté client, y compris pour les comptes
--    qui ne correspondent à aucun contact) et respecte
--    privacy_findable_by_phone directement dans la requête.
-- ============================================================================

create or replace function public.match_users_by_phone(phone_numbers text[])
returns table (id uuid, prenom text, photo_url text)
language sql
stable
security definer set search_path = public
as $$
  select u.id, u.prenom, u.photo_url
  from public.users u
  where u.phone = any(phone_numbers)
    and u.id <> auth.uid()
    and coalesce(u.privacy_findable_by_phone, true) = true;
$$;

grant execute on function public.match_users_by_phone(text[]) to authenticated;
