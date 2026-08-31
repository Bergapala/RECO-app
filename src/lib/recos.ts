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
  url: string | null;
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
  commentCount: number;
  hasLiked: boolean;
  hasDiscovered: boolean;
  isSaved: boolean;
};

type RecoRow = {
  id: string;
  titre: string;
  url: string | null;
  commentaire: string | null;
  apercu_image: string | null;
  categorie: string | null;
  created_at: string;
  user_id: string;
  users: { id: string; prenom: string | null; photo_url: string | null } | null;
  reactions: { type: 'like' | 'discovered'; user_id: string }[] | null;
  comments: { count: number }[] | null;
  // Grâce à la policy RLS "saved_recos_select_own" (strictement privée),
  // ce tableau ne contient jamais que la ligne du viewer lui-même le cas
  // échéant — pas besoin de filtrer par viewerId côté client comme pour
  // reactions/comments.
  saved_recos: { id: string }[] | null;
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
  'id, titre, url, commentaire, apercu_image, categorie, created_at, user_id, users(id, prenom, photo_url), reactions(type, user_id), comments(count), saved_recos(id)';

function mapRecoRows(rows: RecoRow[], viewerId: string | null): FeedReco[] {
  return rows.map((row) => {
    const reactions = row.reactions ?? [];
    return {
      id: row.id,
      titre: row.titre,
      url: row.url,
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
      commentCount: row.comments?.[0]?.count ?? 0,
      hasLiked: reactions.some((r) => r.type === 'like' && r.user_id === viewerId),
      hasDiscovered: reactions.some((r) => r.type === 'discovered' && r.user_id === viewerId),
      isSaved: (row.saved_recos?.length ?? 0) > 0,
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

/**
 * Recos précises par id, dans le même ordre que `recoIds` (utilisé par
 * src/lib/saved.ts pour l'écran "Mes enregistrements", où l'ordre voulu
 * est celui de l'enregistrement, pas l'ordre renvoyé par `.in()`).
 */
export async function fetchRecosByIds(
  recoIds: string[],
  viewerId: string | null,
): Promise<FeedReco[]> {
  if (!isSupabaseConfigured || recoIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('recos').select(RECO_SELECT).in('id', recoIds);

  if (error || !data) {
    return [];
  }

  const mapped = mapRecoRows(data as unknown as RecoRow[], viewerId);
  const order = new Map(recoIds.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Une reco précise (écran détail — src/app/reco/[id].tsx). */
export async function getRecoById(
  recoId: string,
  viewerId: string | null,
): Promise<FeedReco | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from('recos')
    .select(RECO_SELECT)
    .eq('id', recoId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRecoRows([data as unknown as RecoRow], viewerId)[0] ?? null;
}

export type RecoEdits = {
  titre: string;
  url: string | null;
  apercuImage: string | null;
  commentaire: string;
  categorie: string;
};

/** Modifie une reco existante (doit être la sienne — RLS l'impose). */
export async function updateReco(
  recoId: string,
  edits: RecoEdits,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase
    .from('recos')
    .update({
      titre: edits.titre,
      url: edits.url,
      apercu_image: edits.apercuImage,
      commentaire: edits.commentaire,
      categorie: edits.categorie,
    })
    .eq('id', recoId);

  return { error: error?.message ?? null };
}

/** Supprime une reco (doit être la sienne — RLS l'impose). */
export async function deleteReco(recoId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase.from('recos').delete().eq('id', recoId);
  return { error: error?.message ?? null };
}
