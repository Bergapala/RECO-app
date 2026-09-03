import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/** Liste fixe et fermée — voir la contrainte CHECK "reports_reason_check"
 * (migration 20260908090000_reports.sql) qui verrouille les mêmes 4
 * valeurs côté base. Ne jamais permettre à l'utilisateur d'en taper une
 * autre : toute nouvelle raison doit être ajoutée ICI ET dans cette
 * contrainte. */
export const REPORT_REASONS = [
  { emoji: '🚫', label: 'Contenu inapproprié' },
  { emoji: '🤥', label: 'Fausse information' },
  { emoji: '💰', label: 'Spam ou publicité' },
  { emoji: '⚠️', label: 'Autre' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['label'];

/**
 * Envoie un signalement pour une reco (voir le modal dans
 * src/app/reco/[id].tsx). Si la même reco atteint 2 signalements, un
 * trigger côté base passe automatiquement son status à "flagged" — rien à
 * faire de plus ici.
 */
export async function submitReport(
  reporterId: string,
  recoId: string,
  reason: ReportReason,
  details: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const trimmedDetails = details.trim();

  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reco_id: recoId,
    reason,
    details: trimmedDetails.length > 0 ? trimmedDetails : null,
  });

  return { error: error?.message ?? null };
}
