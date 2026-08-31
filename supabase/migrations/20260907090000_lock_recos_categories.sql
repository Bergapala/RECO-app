-- Verrouille définitivement categorie sur les 9 valeurs officielles —
-- aucune contrainte CHECK n'existait encore sur cette colonne (vérifié
-- dans toutes les migrations précédentes avant d'écrire celle-ci).
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. Nettoie les données de test existantes hors liste (ex. "Restaurant",
--    "Voyage", "Film" sans le "/Série") — sinon l'ajout de la contrainte
--    plus bas échouerait sur ces lignes. Les réactions/commentaires/
--    enregistrements liés à ces recos partent avec (on delete cascade,
--    déjà en place sur ces tables).
-- ============================================================================

delete from public.recos
where categorie is not null
  and categorie not in (
    'Film/Série', 'YouTube', 'Podcast', 'Musique', 'Article',
    'Livre', 'Jeu vidéo', 'App', 'Autre'
  );

-- ============================================================================
-- 2. Contrainte CHECK — verrouille la colonne pour de bon, quel que soit
--    le client (app, script, SQL Editor...). NULL reste autorisé : une
--    reco sans catégorie n'est pas "invalide", juste pas encore
--    catégorisée (en pratique l'app en impose toujours une avant de
--    publier, mais la contrainte n'a pas besoin d'être plus stricte que
--    ça côté base).
-- ============================================================================

alter table public.recos
  drop constraint if exists recos_categorie_check;
alter table public.recos
  add constraint recos_categorie_check
  check (
    categorie in (
      'Film/Série', 'YouTube', 'Podcast', 'Musique', 'Article',
      'Livre', 'Jeu vidéo', 'App', 'Autre'
    )
  );
