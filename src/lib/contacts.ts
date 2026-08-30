import * as Contacts from 'expo-contacts';

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
    .select('id, prenom, photo_url, phone')
    .not('phone', 'is', null);

  if (error || !usersWithPhone) return [];

  return usersWithPhone
    .filter(
      (user) =>
        user.id !== currentUserId && user.phone && phones.has(normalizePhone(user.phone)),
    )
    .map((user) => ({ id: user.id, prenom: user.prenom, photoUrl: user.photo_url }));
}
