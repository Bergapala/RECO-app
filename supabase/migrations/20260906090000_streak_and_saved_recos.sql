-- Deux ajouts :
-- 1. Streak hebdomadaire (🔥) — colonnes + trigger qui le recalcule à
--    chaque nouvelle reco publiée.
-- 2. Table saved_recos — liste d'enregistrements strictement privée
--    (aucune policy ne permet à qui que ce soit de voir les enregistrements
--    d'un autre utilisateur).
--
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. Streak hebdomadaire
-- ============================================================================

alter table public.users
  add column if not exists streak_count integer not null default 0,
  add column if not exists last_post_date date;

-- Semaine ISO (lundi -> dimanche, comme notif_day où 0 = lundi) :
-- - dernière reco cette semaine-ci -> streak inchangé
-- - dernière reco la semaine passée -> streak + 1
-- - dernière reco plus ancienne (ou jamais) -> streak repart à 1
create or replace function public.update_streak_on_new_reco()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  this_week date := date_trunc('week', now())::date;
  last_week date := this_week - 7;
  post_week date;
  prev_streak integer;
  prev_last_post date;
begin
  select streak_count, last_post_date into prev_streak, prev_last_post
    from public.users
    where id = new.user_id;

  if prev_last_post is null then
    update public.users
      set streak_count = 1, last_post_date = current_date
      where id = new.user_id;
    return new;
  end if;

  post_week := date_trunc('week', prev_last_post)::date;

  if post_week = this_week then
    -- Déjà posté cette semaine : le streak ne change pas, mais on note
    -- quand même la date pour ne pas perdre la trace du dernier post.
    update public.users
      set last_post_date = current_date
      where id = new.user_id;
  elsif post_week = last_week then
    update public.users
      set streak_count = coalesce(prev_streak, 0) + 1, last_post_date = current_date
      where id = new.user_id;
  else
    update public.users
      set streak_count = 1, last_post_date = current_date
      where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_reco_new_update_streak on public.recos;
create trigger on_reco_new_update_streak
  after insert on public.recos
  for each row execute function public.update_streak_on_new_reco();

-- Préparation V2 (pas implémentée ici) : notification du dimanche soir
-- "C'est ton dernier jour pour poster avant de perdre ton streak 🔥" pour
-- qui n'a pas posté cette semaine. Nécessite un job planifié (pg_cron),
-- absent de ce projet — on prépare juste le type ci-dessous pour que
-- l'app sache déjà l'afficher le jour où ce job existera.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'new_reco', 'reminder', 'friend_accepted', 'streak_warning'));

-- ============================================================================
-- 2. saved_recos — enregistrements privés (bouton 💾)
-- ============================================================================

create table if not exists public.saved_recos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  reco_id uuid not null references public.recos (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_recos_unique_pair unique (user_id, reco_id)
);

create index if not exists saved_recos_user_id_idx on public.saved_recos (user_id);
create index if not exists saved_recos_reco_id_idx on public.saved_recos (reco_id);

alter table public.saved_recos enable row level security;

-- Strictement privé : contrairement à recos/reactions/comments, pas
-- d'exception "visible par les amis" — seul le propriétaire peut voir,
-- créer ou supprimer ses propres enregistrements.
drop policy if exists "saved_recos_select_own" on public.saved_recos;
create policy "saved_recos_select_own"
  on public.saved_recos for select
  using (auth.uid() = user_id);

drop policy if exists "saved_recos_insert_own" on public.saved_recos;
create policy "saved_recos_insert_own"
  on public.saved_recos for insert
  with check (auth.uid() = user_id);

drop policy if exists "saved_recos_delete_own" on public.saved_recos;
create policy "saved_recos_delete_own"
  on public.saved_recos for delete
  using (auth.uid() = user_id);
