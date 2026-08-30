-- Table comments (écran détail reco) + activation du Realtime dessus, pour
-- que la liste de commentaires se mette à jour en direct chez tout le monde
-- en train de regarder la même reco.
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  reco_id uuid not null references public.recos (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  texte text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_reco_id_idx on public.comments (reco_id);
create index if not exists comments_user_id_idx on public.comments (user_id);

alter table public.comments enable row level security;

-- Même logique de visibilité que reactions : on peut voir les commentaires
-- d'une reco qu'on peut voir soi-même (la sienne, ou celle d'un ami
-- accepté).
drop policy if exists "comments_select_visible_recos" on public.comments;
create policy "comments_select_visible_recos"
  on public.comments for select
  using (
    exists (
      select 1 from public.recos r
      where r.id = comments.reco_id
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

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
  on public.comments for delete
  using (auth.uid() = user_id);

-- Realtime : nécessaire pour que la liste de commentaires se mette à jour
-- en direct (voir src/app/reco/[id].tsx). Idempotent — ne râle pas si déjà
-- activé.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;
