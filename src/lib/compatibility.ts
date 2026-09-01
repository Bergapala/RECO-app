import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type CompatibilityScore = {
  /** 0-100, arrondi à l'entier le plus proche. */
  score: number;
  /** Numérateur : recos de l'un likées ❤️ ou marquées 👀 par l'autre (une
   * reco likée ET découverte par la même personne ne compte qu'une fois). */
  commonCount: number;
  /** Dénominateur : total des recos postées par les deux personnes. */
  totalCount: number;
};

async function getRecoIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.from('recos').select('id').eq('user_id', userId);
  if (error || !data) return [];

  return data.map((row) => row.id);
}

/** Nombre de recos distinctes (parmi `recoIds`) sur lesquelles `reactorId`
 * a un like ou un "découvert" — le bookmark n'entre jamais en compte ici. */
async function countDistinctReactedRecos(reactorId: string, recoIds: string[]): Promise<number> {
  if (!isSupabaseConfigured || recoIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('reactions')
    .select('reco_id')
    .eq('user_id', reactorId)
    .in('type', ['like', 'discovered'])
    .in('reco_id', recoIds);

  if (error || !data) return 0;

  return new Set(data.map((row) => row.reco_id)).size;
}

/**
 * Score de compatibilité entre `myId` et `friendId`, basé uniquement sur
 * les recos "en commun" — postées par l'un et likées ❤️ ou marquées 👀 par
 * l'autre (jamais le bookmark 💾). Renvoie `null` s'il y a moins de 3
 * recos postées à eux deux (pas assez de données pour un score qui ait du
 * sens) — voir src/app/profile/[id].tsx.
 *
 * Entièrement calculé côté client à partir des policies RLS déjà en place
 * (recos_select_own_and_friends, reactions_select_visible_recos) : aucune
 * nouvelle requête SQL/migration n'est nécessaire pour cette fonctionnalité.
 */
export async function getCompatibilityScore(
  myId: string,
  friendId: string,
): Promise<CompatibilityScore | null> {
  if (!isSupabaseConfigured) return null;

  const [myRecoIds, friendRecoIds] = await Promise.all([
    getRecoIds(myId),
    getRecoIds(friendId),
  ]);

  const totalCount = myRecoIds.length + friendRecoIds.length;
  if (totalCount < 3) return null;

  const [friendReactedToMine, iReactedToFriends] = await Promise.all([
    countDistinctReactedRecos(friendId, myRecoIds),
    countDistinctReactedRecos(myId, friendRecoIds),
  ]);

  const commonCount = friendReactedToMine + iReactedToFriends;
  const score = Math.round((commonCount / totalCount) * 100);

  return { score, commonCount, totalCount };
}

/** Sous-titre affiché sous le score — voir src/app/profile/[id].tsx. */
export function getCompatibilitySubtitle(compat: CompatibilityScore): string {
  if (compat.commonCount === 0) {
    return 'Commencez à interagir pour voir votre compatibilité 👋';
  }
  if (compat.score <= 25) return 'Vous avez des goûts très différents 🌍';
  if (compat.score <= 50) return 'Quelques découvertes en commun 👀';
  if (compat.score <= 75) return 'Vous aimez les mêmes choses ! 🔥';
  return 'Esprits similaires 🧠✨';
}
