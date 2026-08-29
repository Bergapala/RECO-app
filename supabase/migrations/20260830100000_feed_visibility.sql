-- Les policies RLS initiales de recos et reactions (voir
-- 20260828120000_create_reco_tables.sql) limitaient chaque utilisateur à
-- ses propres lignes uniquement. Le feed a besoin de voir les recos ET les
-- réactions des AMIS ACCEPTÉS — sans ça, le feed serait toujours vide et
-- les compteurs ❤️/👀 toujours à 0, même pour ses propres recos vues par
-- quelqu'un d'autre.
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

-- recos : visible si c'est la sienne, ou postée par un ami accepté (dans
-- un sens ou dans l'autre de la relation friends).
drop policy if exists "recos_select_own" on public.recos;

create policy "recos_select_own_and_friends"
  on public.recos for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friends f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = recos.user_id)
          or (f.friend_id = auth.uid() and f.user_id = recos.user_id)
        )
    )
  );

-- reactions : visible si on peut voir la reco sur laquelle elle porte
-- (la sienne, ou celle d'un ami accepté) — nécessaire pour calculer les
-- compteurs ❤️/👀 de tout le monde, pas seulement les siens.
drop policy if exists "reactions_select_own" on public.reactions;

create policy "reactions_select_visible_recos"
  on public.reactions for select
  using (
    exists (
      select 1 from public.recos r
      where r.id = reactions.reco_id
        and (
          r.user_id = auth.uid()
          or exists (
            select 1 from public.friends f
            where f.status = 'accepted'
              and (
                (f.user_id = auth.uid() and f.friend_id = r.user_id)
                or (f.friend_id = auth.uid() and f.user_id = r.user_id)
              )
          )
        )
    )
  );
