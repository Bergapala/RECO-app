import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserSearchResult = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
  username: string;
};

/**
 * Cherche des utilisateurs par prénom OU par username (recherche
 * insensible à la casse, sous-chaîne). Un "@" en tête de la requête (ex.
 * "@antoine") est retiré avant de matcher le username, pour permettre de
 * chercher directement quelqu'un qui n'a pas synchronisé son téléphone.
 * Exclut l'utilisateur `currentUserId` des résultats.
 *
 * Remarque : la table `users` n'a pas de colonne numéro de téléphone —
 * seules les recherches par nom et par username sont donc réellement
 * branchées, même si le sous-titre de l'écran mentionne aussi le téléphone.
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

  const usernameQuery = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  let request = supabase
    .from('users')
    .select('id, prenom, photo_url, username')
    .or(`prenom.ilike."%${trimmed}%",username.ilike."%${usernameQuery}%"`)
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
    username: row.username,
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

export type FriendListItem = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
  /** Date de création de la relation (ISO) — voir src/app/friends.tsx. */
  addedAt: string;
};

/**
 * Liste des amis acceptés de `userId`, triée du plus récent au plus
 * ancien. La table `friends` n'a pas de relation FK unique exploitable
 * directement par PostgREST dans les deux sens (user_id et friend_id
 * pointent tous deux vers `users`), donc on récupère d'abord les lignes
 * de relation puis les profils correspondants en un second appel.
 */
export async function getFriendsList(userId: string): Promise<FriendListItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data: rows, error } = await supabase
    .from('friends')
    .select('user_id, friend_id, created_at')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error || !rows || rows.length === 0) return [];

  const otherIds = rows.map((row) => (row.user_id === userId ? row.friend_id : row.user_id));
  const addedAtById = new Map(
    rows.map((row) => [row.user_id === userId ? row.friend_id : row.user_id, row.created_at as string]),
  );

  const { data: profiles, error: profilesError } = await supabase
    .from('users')
    .select('id, prenom, photo_url')
    .in('id', otherIds);

  if (profilesError || !profiles) return [];

  return profiles
    .map((profile) => ({
      id: profile.id,
      prenom: profile.prenom,
      photoUrl: profile.photo_url,
      addedAt: addedAtById.get(profile.id) ?? new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

/**
 * Supprime la relation d'amitié entre `currentUserId` et `friendId`, quel
 * que soit le sens dans lequel elle a été créée. Repose sur la policy RLS
 * "friends_delete_involved" (déjà en place), qui autorise chacune des deux
 * personnes impliquées à supprimer la relation — aucune migration SQL
 * n'est nécessaire pour cette fonctionnalité.
 */
export async function removeFriend(
  currentUserId: string,
  friendId: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase
    .from('friends')
    .delete()
    .or(
      `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`,
    );

  return { error: error?.message ?? null };
}

export type FriendshipStatus = 'none' | 'pending' | 'accepted';

/**
 * Statut de la relation entre `currentUserId` et `otherUserId`, dans
 * n'importe quel sens (peu importe qui a envoyé la demande) — voir
 * src/app/profile/[id].tsx.
 */
export async function getFriendshipStatus(
  currentUserId: string,
  otherUserId: string,
): Promise<FriendshipStatus> {
  if (!isSupabaseConfigured) return 'none';

  const { data } = await supabase
    .from('friends')
    .select('status')
    .or(
      `and(user_id.eq.${currentUserId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${currentUserId})`,
    )
    .maybeSingle();

  return (data?.status as FriendshipStatus | undefined) ?? 'none';
}

export type PendingFriendRequest = {
  /** Id de la ligne `friends` — nécessaire pour accepter/refuser. */
  id: string;
  createdAt: string;
  sender: {
    id: string;
    prenom: string | null;
    photoUrl: string | null;
  };
};

type PendingFriendRequestRow = {
  id: string;
  created_at: string;
  sender: { id: string; prenom: string | null; photo_url: string | null } | null;
};

/**
 * Demandes d'amis reçues par `userId` et pas encore traitées — affichées
 * en haut de l'écran notifications (voir src/app/notifications.tsx).
 * `!user_id` désambiguïse la jointure vers users, comme pour `actor_id`
 * dans lib/notifications.ts : `friends` a deux FK vers `users`.
 */
export async function getPendingFriendRequests(userId: string): Promise<PendingFriendRequest[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('friends')
    .select('id, created_at, sender:users!user_id(id, prenom, photo_url)')
    .eq('friend_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as unknown as PendingFriendRequestRow[])
    .filter((row) => row.sender !== null)
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      sender: {
        id: row.sender!.id,
        prenom: row.sender!.prenom,
        photoUrl: row.sender!.photo_url,
      },
    }));
}

/** Accepte une demande d'ami — le trigger `notify_on_friend_accepted`
 * (voir la migration username_and_friend_requests) se charge de notifier
 * l'expéditeur, pas besoin de le faire depuis le client. */
export async function acceptFriendRequest(requestId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  return { error: error?.message ?? null };
}

/** Refuse une demande d'ami — supprime simplement la ligne, l'expéditeur
 * pourra retenter plus tard. */
export async function declineFriendRequest(requestId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase.from('friends').delete().eq('id', requestId);
  return { error: error?.message ?? null };
}
