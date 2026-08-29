import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type NewReco = {
  userId: string;
  titre: string;
  url: string | null;
  apercuImage: string | null;
  commentaire: string;
  categorie: string;
};

/** Publie une nouvelle reco (voir src/app/add-reco.tsx). */
export async function createReco(reco: NewReco): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase.from('recos').insert({
    user_id: reco.userId,
    titre: reco.titre,
    url: reco.url,
    apercu_image: reco.apercuImage,
    commentaire: reco.commentaire,
    categorie: reco.categorie,
  });

  return { error: error?.message ?? null };
}

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
    .select(RECO_SELECT)
    .in('user_id', friendIds)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return mapRecoRows(data as unknown as RecoRow[], currentUserId);
}

const RECO_SELECT =
  'id, titre, commentaire, apercu_image, categorie, created_at, user_id, users(id, prenom, photo_url), reactions(type, user_id)';

function mapRecoRows(rows: RecoRow[], viewerId: string | null): FeedReco[] {
  return rows.map((row) => {
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
      hasLiked: reactions.some((r) => r.type === 'like' && r.user_id === viewerId),
      hasDiscovered: reactions.some((r) => r.type === 'discovered' && r.user_id === viewerId),
    };
  });
}

/**
 * Recos publiées par `authorId` (utilisé pour "mon profil" et le profil
 * d'un pote), triées par date décroissante, avec l'état des réactions
 * relatif à `viewerId` (la personne qui consulte l'écran).
 */
export async function fetchRecosByAuthor(
  authorId: string,
  viewerId: string | null,
): Promise<FeedReco[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('recos')
    .select(RECO_SELECT)
    .eq('user_id', authorId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return mapRecoRows(data as unknown as RecoRow[], viewerId);
}
