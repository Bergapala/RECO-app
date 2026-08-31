import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { FeedReco } from '@/lib/recos';
import { toggleSavedReco } from '@/lib/saved';

/**
 * Bascule le bouton bookmark 💾 sur une liste de recos affichée via
 * RecoCard (feed, mon profil, profil d'un pote, mes enregistrements) : met
 * à jour l'état local de façon optimiste, puis annule si l'appel Supabase
 * échoue. Miroir de useRecoReactions, séparé car les enregistrements
 * vivent dans leur propre table (saved_recos), pas dans reactions.
 */
export function useSavedRecos(
  setRecos: Dispatch<SetStateAction<FeedReco[]>>,
  currentUserId: string | null,
) {
  const onToggleSave = useCallback(
    async (reco: FeedReco) => {
      if (!currentUserId) return;

      const wasSaved = reco.isSaved;
      const applyState = (saved: boolean) =>
        setRecos((current) =>
          current.map((item) => (item.id === reco.id ? { ...item, isSaved: saved } : item)),
        );

      applyState(!wasSaved);

      const { saved } = await toggleSavedReco(reco.id, currentUserId, wasSaved);
      if (saved === wasSaved) {
        // L'appel a échoué : on annule la mise à jour optimiste.
        applyState(wasSaved);
      }
    },
    [setRecos, currentUserId],
  );

  return { onToggleSave };
}
