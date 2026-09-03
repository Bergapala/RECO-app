import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
  username: string;
  /** Nombre de semaines consécutives avec au moins une reco postée — voir
   * le trigger update_streak_on_new_reco (migration streak_and_saved_recos). */
  streakCount: number;
};

/**
 * `phone` a volontairement disparu de ce type/de cette requête — cet appel
 * sert aussi bien à afficher son propre profil qu'à consulter celui d'un
 * autre utilisateur (voir src/app/profile/[id].tsx), et la migration
 * restrict_sensitive_columns retire de toute façon le droit de lire
 * phone/push_token via une requête directe sur `users`, y compris pour sa
 * propre ligne. Pour savoir si l'utilisateur courant a déjà un numéro
 * enregistré, voir hasOwnPhone() ci-dessous — jamais le numéro lui-même.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, prenom, photo_url, username, streak_count')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    prenom: data.prenom,
    photoUrl: data.photo_url,
    username: data.username,
    streakCount: data.streak_count ?? 0,
  };
}

/**
 * `true` si l'utilisateur courant a déjà un numéro de téléphone enregistré
 * — voir src/app/complete-profile.tsx, qui n'a besoin que de ce booléen
 * (masquer ou non le champ de saisie), jamais du numéro en clair. Passe
 * par la fonction security definer `current_user_has_phone` (voir la
 * migration restrict_sensitive_columns) puisqu'une lecture directe de la
 * colonne `phone` n'est plus autorisée, même pour sa propre ligne.
 */
export async function hasOwnPhone(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { data, error } = await supabase.rpc('current_user_has_phone');
  if (error) return false;

  return data ?? false;
}

export type ProfileStats = {
  recoCount: number;
  friendCount: number;
};

/** Nombre de recos postées et d'amis acceptés — voir src/app/profile/index.tsx. */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  if (!isSupabaseConfigured) return { recoCount: 0, friendCount: 0 };

  const [recosResult, friendsResult] = await Promise.all([
    supabase.from('recos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
  ]);

  return {
    recoCount: recosResult.count ?? 0,
    friendCount: friendsResult.data?.length ?? 0,
  };
}

export async function updatePrenom(userId: string, prenom: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase.from('users').update({ prenom }).eq('id', userId);
  return { error: error?.message ?? null };
}

export async function updatePhone(userId: string, phone: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase.from('users').update({ phone }).eq('id', userId);
  return { error: error?.message ?? null };
}

/** Lettres minuscules, chiffres, underscore, 3 à 20 caractères — reflète
 * exactement la contrainte `users_username_format_check` côté base. */
export function isValidUsernameFormat(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

/** Vérifie la disponibilité d'un username (insensible à la casse), en
 * excluant la ligne de l'utilisateur courant (pour qu'il puisse "garder"
 * son propre username sans qu'il se signale comme déjà pris). Renvoie
 * `false` si le format est invalide, sans même interroger la base. */
export async function isUsernameAvailable(
  username: string,
  currentUserId: string | null,
): Promise<boolean> {
  if (!isValidUsernameFormat(username)) return false;
  if (!isSupabaseConfigured) return true;

  let request = supabase.from('users').select('id').ilike('username', username);
  if (currentUserId) {
    request = request.neq('id', currentUserId);
  }

  const { data, error } = await request;
  if (error) return false;

  return (data?.length ?? 0) === 0;
}

export async function updateUsername(
  userId: string,
  username: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase.from('users').update({ username }).eq('id', userId);
  if (error?.code === '23505') {
    // Contrainte unique violée (quelqu'un a pris ce username entre la
    // dernière vérification et cet enregistrement) — message clair plutôt
    // que l'erreur Postgres brute.
    return { error: 'Ce nom d’utilisateur vient d’être pris, choisis-en un autre.' };
  }
  return { error: error?.message ?? null };
}

export async function updatePhotoUrl(
  userId: string,
  photoUrl: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase.from('users').update({ photo_url: photoUrl }).eq('id', userId);
  return { error: error?.message ?? null };
}

export type NotifHourSlot = '8-10' | '12-14' | '16-18' | '20-22';

export type NotificationPrefs = {
  notifEnabled: boolean;
  notifDay: number | null; // 0 = lundi ... 6 = dimanche
  notifHour: NotifHourSlot | null;
  notifReactions: boolean;
  notifComments: boolean;
  notifNewRecos: boolean;
  notifFriendRequests: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  notifEnabled: true,
  notifDay: null,
  notifHour: null,
  notifReactions: true,
  notifComments: true,
  notifNewRecos: true,
  notifFriendRequests: true,
};

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  if (!isSupabaseConfigured) return DEFAULT_PREFS;

  const { data, error } = await supabase
    .from('users')
    .select(
      'notif_enabled, notif_day, notif_hour, notif_reactions, notif_comments, notif_new_recos, notif_friend_requests',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return DEFAULT_PREFS;

  return {
    notifEnabled: data.notif_enabled ?? true,
    notifDay: data.notif_day,
    notifHour: data.notif_hour as NotifHourSlot | null,
    notifReactions: data.notif_reactions ?? true,
    notifComments: data.notif_comments ?? true,
    notifNewRecos: data.notif_new_recos ?? true,
    notifFriendRequests: data.notif_friend_requests ?? true,
  };
}

export async function updateNotificationPrefs(
  userId: string,
  edits: Partial<NotificationPrefs>,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const payload: Record<string, unknown> = {};
  if (edits.notifEnabled !== undefined) payload.notif_enabled = edits.notifEnabled;
  if (edits.notifDay !== undefined) payload.notif_day = edits.notifDay;
  if (edits.notifHour !== undefined) payload.notif_hour = edits.notifHour;
  if (edits.notifReactions !== undefined) payload.notif_reactions = edits.notifReactions;
  if (edits.notifComments !== undefined) payload.notif_comments = edits.notifComments;
  if (edits.notifNewRecos !== undefined) payload.notif_new_recos = edits.notifNewRecos;
  if (edits.notifFriendRequests !== undefined) {
    payload.notif_friend_requests = edits.notifFriendRequests;
  }

  const { error } = await supabase.from('users').update(payload).eq('id', userId);
  return { error: error?.message ?? null };
}

export type PrivacyPrefs = {
  /** Autorise mes amis à voir ma liste d'amis. */
  showFriendsToFriends: boolean;
  /** Apparaître dans les résultats de synchronisation de contacts des
   * autres utilisateurs — voir findContactsOnReco dans src/lib/contacts.ts. */
  findableByPhone: boolean;
};

const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  showFriendsToFriends: true,
  findableByPhone: true,
};

export async function getPrivacyPrefs(userId: string): Promise<PrivacyPrefs> {
  if (!isSupabaseConfigured) return DEFAULT_PRIVACY_PREFS;

  const { data, error } = await supabase
    .from('users')
    .select('privacy_show_friends_to_friends, privacy_findable_by_phone')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return DEFAULT_PRIVACY_PREFS;

  return {
    showFriendsToFriends: data.privacy_show_friends_to_friends ?? true,
    findableByPhone: data.privacy_findable_by_phone ?? true,
  };
}

export async function updatePrivacyPrefs(
  userId: string,
  edits: Partial<PrivacyPrefs>,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const payload: Record<string, unknown> = {};
  if (edits.showFriendsToFriends !== undefined) {
    payload.privacy_show_friends_to_friends = edits.showFriendsToFriends;
  }
  if (edits.findableByPhone !== undefined) {
    payload.privacy_findable_by_phone = edits.findableByPhone;
  }

  const { error } = await supabase.from('users').update(payload).eq('id', userId);
  return { error: error?.message ?? null };
}

export async function updatePushToken(
  userId: string,
  pushToken: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase.from('users').update({ push_token: pushToken }).eq('id', userId);
  return { error: error?.message ?? null };
}
