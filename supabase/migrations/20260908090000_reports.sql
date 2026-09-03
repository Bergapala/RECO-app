-- Signalement de contenu (conformité Apple — App Store Review Guideline
-- 1.2 "Safety" : les apps avec du contenu généré par les utilisateurs
-- doivent permettre de le signaler) : table reports + verrouillage
-- automatique d'une reco qui atteint 2 signalements.
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run.

-- ============================================================================
-- 1. recos.status — colonne absente jusqu'ici. 'active' par défaut,
--    'flagged' une fois signalée deux fois (voir trigger plus bas).
-- ============================================================================

alter table public.recos
  add column if not exists status text not null default 'active';

alter table public.recos
  drop constraint if exists recos_status_check;
alter table public.recos
  add constraint recos_status_check
  check (status in ('active', 'flagged'));

-- ============================================================================
-- 2. reports — un signalement = un utilisateur qui signale une reco pour
--    une raison donnée, avec un détail libre optionnel (voir
--    src/app/reco/[id].tsx pour le modal correspondant).
-- ============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  reco_id uuid not null references public.recos (id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint reports_reason_check check (
    reason in ('Contenu inapproprié', 'Fausse information', 'Spam ou publicité', 'Autre')
  ),
  constraint reports_status_check check (status in ('pending', 'reviewed')),
  -- Un même utilisateur ne peut signaler une même reco qu'une fois — évite
  -- qu'un signalement répété artificiellement par une seule personne ne
  -- déclenche à lui seul le trigger de la section 3.
  constraint reports_unique_reporter_reco unique (reporter_id, reco_id)
);

create index if not exists reports_reco_id_idx on public.reports (reco_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- Un utilisateur ne voit que ses propres signalements — jamais ceux des
-- autres (pas de vue "modération" côté app, ça reste un outil dashboard).
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Pas de policy update/delete : faire passer un signalement à "reviewed"
-- se fait côté dashboard/service_role, jamais depuis l'app.

-- ============================================================================
-- 3. Trigger — dès qu'une reco atteint 2 signalements (forcément distincts
--    grâce à reports_unique_reporter_reco ci-dessus), son status passe à
--    "flagged". security definer nécessaire : le trigger doit pouvoir
--    compter TOUS les signalements de la reco, pas seulement ceux visibles
--    par la policy RLS "reports_select_own" pour l'auteur du insert en cours.
-- ============================================================================

create or replace function public.flag_reco_after_reports()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from public.reports where reco_id = new.reco_id) >= 2 then
    update public.recos
      set status = 'flagged'
      where id = new.reco_id and status <> 'flagged';
  end if;
  return new;
end;
$$;

drop trigger if exists on_report_created on public.reports;
create trigger on_report_created
  after insert on public.reports
  for each row execute function public.flag_reco_after_reports();
