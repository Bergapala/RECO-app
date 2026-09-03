import * as Contacts from 'expo-contacts';

import { BlockCheckError, getBlockedUserIds } from '@/lib/blocks';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type ContactMatch = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
};

/** Garde uniquement les chiffres (et un éventuel + en tête) pour comparer
 * deux numéros écrits différemment (espaces, tirets, indicatif...). Best
 * effort — pas une vraie normalisation E.164. */
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

/**
 * `null` = permission refusée. `[]` = permission accordée mais aucun
 * contact du téléphone n'a de compte RECO. Sinon, la liste des comptes
 * trouvés.
 *
 * La comparaison numéro-par-numéro se fait côté base (RPC
 * `match_users_by_phone`, voir la migration restrict_sensitive_columns)
 * plutôt qu'en téléchargeant le numéro de tout le monde vers le client
 * pour comparer localement : aucun numéro de téléphone d'un autre
 * utilisateur ne transite jamais côté client, et `privacy_findable_by_phone`
 * est appliqué directement dans la requête plutôt qu'après coup en JS.
 */
export async function findContactsOnReco(
  currentUserId: string | null,
): Promise<ContactMatch[] | null> {
  if (!isSupabaseConfigured) return [];

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const { data: deviceContacts } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const phones = new Set<string>();
  for (const contact of deviceContacts) {
    for (const entry of contact.phoneNumbers ?? []) {
      if (entry.number) phones.add(normalizePhone(entry.number));
    }
  }

  if (phones.size === 0) return [];

  type PhoneMatchRow = { id: string; prenom: string | null; photo_url: string | null };

  const { data: matches, error } = await supabase.rpc('match_users_by_phone', {
    phone_numbers: Array.from(phones),
  });

  if (error || !matches) return [];

  // Exclut les utilisateurs bloqués — dans les deux sens — pour cohérence
  // avec searchUsersByName (voir src/lib/friends.ts) : la synchronisation
  // des contacts est un autre chemin vers le même flux d'ajout d'amis.
  // (Le RPC exclut déjà currentUserId lui-même côté base.) Fail-closed : si
  // la vérification échoue, aucun résultat plutôt qu'un résultat non filtré.
  let blockedIds: string[] = [];
  if (currentUserId) {
    try {
      blockedIds = await getBlockedUserIds(currentUserId);
    } catch (error) {
      if (error instanceof BlockCheckError) return [];
      throw error;
    }
  }

  return (matches as PhoneMatchRow[])
    .filter((user) => !blockedIds.includes(user.id))
    .map((user) => ({ id: user.id, prenom: user.prenom, photoUrl: user.photo_url }));
}

/** État actuel de la permission Contacts iOS, sans déclencher la popup de
 * demande — pour refléter l'état réel du toggle "Synchroniser mes
 * contacts" dans src/app/settings/privacy/index.tsx (au focus de l'écran,
 * pour capter aussi un changement fait depuis Réglages iOS). */
export async function getContactsPermissionStatus(): Promise<Contacts.PermissionStatus> {
  const { status } = await Contacts.getPermissionsAsync();
  return status;
}

/** Déclenche la popup de permission Contacts iOS et renvoie le statut réel
 * obtenu (jamais optimiste : si l'utilisateur refuse, le toggle doit
 * revenir à l'état réel plutôt que rester activé). */
export async function requestContactsPermission(): Promise<Contacts.PermissionStatus> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status;
}
