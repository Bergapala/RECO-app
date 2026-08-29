import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type FeedReco = {
  id: string;
  titre: string;
  commentaire: string | null;
  apercuImage: string | null;
  categorie: string | null;
  createdAt: string;
  author: {
    id: string;
    prenom: string | null;
    photoUrl: string | null;
  };
  likeCount: number;
  discoveredCount: number;
  hasLiked: boolean;
  hasDiscovered: boolean;
};

type RecoRow = {
  id: string;
  titre: string;
  commentaire: string | null;
  apercu_image: string | null;
  categorie: string | null;
  created_at: string;
  user_id: string;
  users: { id: string; prenom: string | null; photo_url: string | null } | null;
  reactions: { type: 'like' | 'discovered'; user_id: string }[] | null;
};

/**
 * Ids des amis dont la relation est "accepted" avec `userId`, dans les deux
 * sens (celui qui a envoyé la demande, ou celui qui l'a reçue).
 */
async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('friends')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error || !data) {
    return [];
  }

  return data.map((row) => (row.user_id === userId ? row.friend_id : row.user_id));
}

/**
 * Charge le feed : les recos des amis acceptés de `currentUserId` (pas les
 * siennes), triées par date décroissante, avec auteur et compteurs de
 * réactions.
 */
export async function fetchFeedRecos(currentUserId: string | null): Promise<FeedReco[]> {
  if (!isSupabaseConfigured || !currentUserId) {
    return [];
  }

  const friendIds = await getAcceptedFriendIds(currentUserId);
  if (friendIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('recos')
    .select('id, titre, commentaire, apercu_image, categorie, created_at, user_id, users(id, prenom, photo_url), reactions(type, user_id)')
    .in('user_id', friendIds)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as unknown as RecoRow[]).map((row) => {
    const reactions = row.reactions ?? [];
    return {
      id: row.id,
      titre: row.titre,
      commentaire: row.commentaire,
      apercuImage: row.apercu_image,
      categorie: row.categorie,
      createdAt: row.created_at,
      author: {
        id: row.users?.id ?? row.user_id,
        prenom: row.users?.prenom ?? null,
        photoUrl: row.users?.photo_url ?? null,
      },
      likeCount: reactions.filter((r) => r.type === 'like').length,
      discoveredCount: reactions.filter((r) => r.type === 'discovered').length,
      hasLiked: reactions.some((r) => r.type === 'like' && r.user_id === currentUserId),
      hasDiscovered: reactions.some((r) => r.type === 'discovered' && r.user_id === currentUserId),
    };
  });
}
