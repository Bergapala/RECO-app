-- La policy RLS initiale de public.users (voir
-- 20260828120000_create_reco_tables.sql) limitait strictement chaque
-- utilisateur à sa propre ligne ("chaque utilisateur ne voit que ses
-- données"). L'écran "Ajout d'amis" a besoin de chercher d'AUTRES
-- utilisateurs par prénom — impossible tant que cette policy reste aussi
-- stricte : la recherche renverrait toujours 0 résultat.
--
-- On l'élargit ici pour que tout utilisateur authentifié puisse lire les
-- profils des autres (nécessaire pour la recherche d'amis). Les policies
-- update/delete restent, elles, limitées à sa propre ligne.
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

drop policy if exists "users_select_own" on public.users;

create policy "users_select_authenticated"
  on public.users for select
  to authenticated
  using (true);
