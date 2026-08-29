import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type ReactionType = 'like' | 'discovered';

/**
 * Bascule une réaction (❤️ like / 👀 discovered) sur une reco : la crée si
 * elle n'existe pas encore pour cet utilisateur, la supprime sinon. Renvoie
 * le nouvel état (`true` = réaction active) pour mettre à jour l'UI de
 * façon optimiste sans avoir à recharger le feed.
 */
export async function toggleReaction(
  recoId: string,
  userId: string,
  type: ReactionType,
  currentlyActive: boolean,
): Promise<{ active: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { active: currentlyActive, error: "Supabase n'est pas encore configuré." };
  }

  if (currentlyActive) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('reco_id', recoId)
      .eq('user_id', userId)
      .eq('type', type);

    return { active: error ? true : false, error: error?.message ?? null };
  }

  const { error } = await supabase
    .from('reactions')
    .insert({ reco_id: recoId, user_id: userId, type });

  // 23505 = déjà réagi (contrainte unique) : traiter comme un succès, l'état
  // final est bien "actif" dans les deux cas.
  if (error && error.code !== '23505') {
    return { active: false, error: error.message };
  }

  return { active: true, error: null };
}
