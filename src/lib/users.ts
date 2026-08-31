import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
  phone: string | null;
  username: string;
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, prenom, photo_url, phone, username')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    prenom: data.prenom,
    photoUrl: data.photo_url,
    phone: data.phone,
    username: data.username,
  };
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
  notifNewRecos: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  notifEnabled: true,
  notifDay: null,
  notifHour: null,
  notifReactions: true,
  notifNewRecos: true,
};

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  if (!isSupabaseConfigured) return DEFAULT_PREFS;

  const { data, error } = await supabase
    .from('users')
    .select('notif_enabled, notif_day, notif_hour, notif_reactions, notif_new_recos')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return DEFAULT_PREFS;

  return {
    notifEnabled: data.notif_enabled ?? true,
    notifDay: data.notif_day,
    notifHour: data.notif_hour as NotifHourSlot | null,
    notifReactions: data.notif_reactions ?? true,
    notifNewRecos: data.notif_new_recos ?? true,
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
  if (edits.notifNewRecos !== undefined) payload.notif_new_recos = edits.notifNewRecos;

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
