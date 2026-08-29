import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, prenom, photo_url')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return { id: data.id, prenom: data.prenom, photoUrl: data.photo_url };
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
