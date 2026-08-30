import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type RecoComment = {
  id: string;
  texte: string;
  createdAt: string;
  author: {
    id: string;
    prenom: string | null;
    photoUrl: string | null;
  };
};

type CommentRow = {
  id: string;
  texte: string;
  created_at: string;
  user_id: string;
  users: { id: string; prenom: string | null; photo_url: string | null } | null;
};

function mapCommentRow(row: CommentRow): RecoComment {
  return {
    id: row.id,
    texte: row.texte,
    createdAt: row.created_at,
    author: {
      id: row.users?.id ?? row.user_id,
      prenom: row.users?.prenom ?? null,
      photoUrl: row.users?.photo_url ?? null,
    },
  };
}

export async function fetchComments(recoId: string): Promise<RecoComment[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('comments')
    .select('id, texte, created_at, user_id, users(id, prenom, photo_url)')
    .eq('reco_id', recoId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return (data as unknown as CommentRow[]).map(mapCommentRow);
}

export async function postComment(
  recoId: string,
  userId: string,
  texte: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase
    .from('comments')
    .insert({ reco_id: recoId, user_id: userId, texte });

  return { error: error?.message ?? null };
}

type RawCommentInsert = {
  id: string;
  texte: string;
  created_at: string;
  user_id: string;
};

/**
 * Abonnement Realtime aux nouveaux commentaires d'une reco. Le payload
 * Realtime ne contient que la ligne brute (pas de jointure sur `users`),
 * donc on va chercher l'auteur séparément avant d'appeler `onInsert`.
 * Renvoie une fonction de désabonnement, à appeler au démontage de l'écran.
 */
export function subscribeToComments(
  recoId: string,
  onInsert: (comment: RecoComment) => void,
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const channel = supabase
    .channel(`comments:${recoId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `reco_id=eq.${recoId}` },
      async (payload) => {
        const row = payload.new as RawCommentInsert;
        const { data: author } = await supabase
          .from('users')
          .select('id, prenom, photo_url')
          .eq('id', row.user_id)
          .maybeSingle();

        onInsert(
          mapCommentRow({
            ...row,
            users: author ?? null,
          }),
        );
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
