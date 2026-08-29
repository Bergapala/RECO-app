import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { toggleReaction, type ReactionType } from '@/lib/reactions';
import type { FeedReco } from '@/lib/recos';

/**
 * Bascule ❤️/👀 sur une liste de recos affichée via RecoCard (feed, mon
 * profil, profil d'un pote) : met à jour l'état local de façon optimiste,
 * puis annule si l'appel Supabase échoue. Centralisé ici pour ne pas
 * dupliquer cette logique dans chaque écran.
 */
export function useRecoReactions(
  setRecos: Dispatch<SetStateAction<FeedReco[]>>,
  currentUserId: string | null,
) {
  const toggle = useCallback(
    async (reco: FeedReco, type: ReactionType) => {
      if (!currentUserId) return;

      const key = type === 'like' ? 'hasLiked' : 'hasDiscovered';
      const countKey = type === 'like' ? 'likeCount' : 'discoveredCount';
      const wasActive = reco[key];

      const applyDelta = (active: boolean) =>
        setRecos((current) =>
          current.map((item) =>
            item.id === reco.id
              ? { ...item, [key]: active, [countKey]: item[countKey] + (active ? 1 : -1) }
              : item,
          ),
        );

      applyDelta(!wasActive);

      const { active } = await toggleReaction(reco.id, currentUserId, type, wasActive);
      if (active === wasActive) {
        // L'appel a échoué : on annule la mise à jour optimiste.
        applyDelta(wasActive);
      }
    },
    [setRecos, currentUserId],
  );

  return {
    onToggleLike: useCallback((reco: FeedReco) => toggle(reco, 'like'), [toggle]),
    onToggleDiscovered: useCallback((reco: FeedReco) => toggle(reco, 'discovered'), [toggle]),
  };
}
