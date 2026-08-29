-- Bucket de stockage pour les images uploadées manuellement depuis l'écran
-- "Ajout de reco" (étape 1, formulaire de secours quand l'URL n'a pas
-- d'aperçu OpenGraph). Public en lecture (les images doivent être visibles
-- par les amis dans le feed), écriture limitée à son propre dossier
-- (convention `<user_id>/...`).
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

insert into storage.buckets (id, name, public)
values ('reco-images', 'reco-images', true)
on conflict (id) do nothing;

drop policy if exists "reco_images_insert_own" on storage.objects;
create policy "reco_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reco-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "reco_images_delete_own" on storage.objects;
create policy "reco_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reco-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "reco_images_public_read" on storage.objects;
create policy "reco_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'reco-images');
