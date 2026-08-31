import { fetchRecosByIds, type FeedReco } from '@/lib/recos';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Enregistre ou retire une reco des enregistrements privés de `userId` —
 * voir le bouton bookmark dans RecoCard et le détail d'une reco.
 * `currentlySaved` est l'état avant le clic (fourni par l'appelant, qui
 * fait la mise à jour optimiste), et détermine s'il faut insérer ou
 * supprimer. Renvoie le nouvel état réellement obtenu, pour que l'appelant
 * puisse annuler sa mise à jour optimiste si l'appel a échoué.
 */
export async function toggleSavedReco(
  recoId: string,
  userId: string,
  currentlySaved: boolean,
): Promise<{ saved: boolean }> {
  if (!isSupabaseConfigured) return { saved: currentlySaved };

  if (currentlySaved) {
    const { error } = await supabase
      .from('saved_recos')
      .delete()
      .eq('user_id', userId)
      .eq('reco_id', recoId);
    return { saved: Boolean(error) };
  }

  const { error } = await supabase.from('saved_recos').insert({ user_id: userId, reco_id: recoId });
  // 23505 = déjà enregistrée (contrainte unique) : pas une vraie erreur,
  // le résultat souhaité (enregistrée) est déjà atteint.
  return { saved: !error || error.code === '23505' };
}

/** Nombre d'enregistrements de `userId` — affiché dans le bandeau "Mes
 * enregistrements" de src/app/profile/index.tsx. */
export async function getSavedRecoCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { count } = await supabase
    .from('saved_recos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count ?? 0;
}

/** Recos enregistrées par `userId`, du plus récemment enregistré au plus
 * ancien — voir src/app/saved.tsx. Liste strictement privée (RLS). */
export async function getSavedRecos(userId: string): Promise<FeedReco[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('saved_recos')
    .select('reco_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return [];

  return fetchRecosByIds(
    data.map((row) => row.reco_id),
    userId,
  );
}
