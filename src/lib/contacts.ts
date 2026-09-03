import * as Contacts from 'expo-contacts';

import { getBlockedUserIds } from '@/lib/blocks';
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

  const { data: usersWithPhone, error } = await supabase
    .from('users')
    .select('id, prenom, photo_url, phone, privacy_findable_by_phone')
    .not('phone', 'is', null);

  if (error || !usersWithPhone) return [];

  // Exclut les utilisateurs bloqués — dans les deux sens — pour cohérence
  // avec searchUsersByName (voir src/lib/friends.ts) : la synchronisation
  // des contacts est un autre chemin vers le même flux d'ajout d'amis.
  const blockedIds = currentUserId ? await getBlockedUserIds(currentUserId) : [];

  return usersWithPhone
    .filter(
      (user) =>
        user.id !== currentUserId &&
        user.phone &&
        // `!== false` plutôt que `=== true` : les lignes déjà en base avant
        // l'ajout de cette colonne (défaut true, mais un null resterait
        // possible sur une valeur jamais réécrite) doivent rester
        // trouvables par défaut, pas disparaître silencieusement.
        user.privacy_findable_by_phone !== false &&
        phones.has(normalizePhone(user.phone)) &&
        !blockedIds.includes(user.id),
    )
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
