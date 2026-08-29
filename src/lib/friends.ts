import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserSearchResult = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
};

/**
 * Cherche des utilisateurs par prénom (recherche insensible à la casse,
 * sous-chaîne). Exclut l'utilisateur `currentUserId` des résultats.
 *
 * Remarque : la table `users` n'a pas de colonne numéro de téléphone —
 * seule la recherche par nom est donc réellement branchée, même si le
 * sous-titre de l'écran mentionne aussi le téléphone.
 *
 * Nécessite que la policy RLS de `public.users` autorise un utilisateur
 * authentifié à lire les profils des autres (voir la migration
 * users_searchable) — sans ça, cette recherche renverra toujours 0 résultat.
 */
export async function searchUsersByName(
  query: string,
  currentUserId: string | null,
): Promise<UserSearchResult[]> {
  const trimmed = query.trim();
  if (!isSupabaseConfigured || trimmed.length === 0) {
    return [];
  }

  let request = supabase
    .from('users')
    .select('id, prenom, photo_url')
    .ilike('prenom', `%${trimmed}%`)
    .limit(20);

  if (currentUserId) {
    request = request.neq('id', currentUserId);
  }

  const { data, error } = await request;
  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    prenom: row.prenom,
    photoUrl: row.photo_url,
  }));
}

export type SendFriendRequestResult = { error: string | null };

/**
 * Crée une demande d'ami (status "pending") de `currentUserId` vers
 * `friendId`. Une demande déjà existante entre ces deux utilisateurs
 * (contrainte unique côté base) est traitée comme un succès plutôt que
 * comme une erreur, pour rester silencieux côté UI.
 */
export async function sendFriendRequest(
  currentUserId: string,
  friendId: string,
): Promise<SendFriendRequestResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase
    .from('friends')
    .insert({ user_id: currentUserId, friend_id: friendId, status: 'pending' });

  if (error && error.code !== '23505') {
    // 23505 = violation de contrainte unique (demande déjà envoyée) : pas
    // une vraie erreur du point de vue de l'utilisateur.
    return { error: error.message };
  }

  return { error: null };
}
