import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Levée par getBlockedUserIds/isBlockedEitherWay quand la vérification de
 * blocage échoue — volontairement fail-closed plutôt que de renvoyer `[]`
 * silencieusement : un appelant qui ignorerait cette erreur planterait
 * plutôt que d'afficher, par exemple, le profil de quelqu'un qui a
 * peut-être bloqué l'utilisateur courant. Chaque appelant (feed, recherche,
 * synchro contacts, garde d'affichage de profil) décide explicitement du
 * comportement sûr à adopter dans ce cas — voir leurs try/catch respectifs.
 */
export class BlockCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockCheckError';
  }
}

/**
 * Ids de tous les utilisateurs impliqués dans un blocage avec `userId`,
 * qu'il en soit l'auteur ou la cible — grâce à la policy RLS symétrique
 * "blocked_users_select_involved" (comme "friends_select_involved" sur la
 * table friends), cette même requête sert à la fois à "qui j'ai bloqué"
 * (pour filtrer mon propre feed/ma recherche) et, appelée depuis l'autre
 * côté, à "qui m'a bloqué" — voir src/lib/recos.ts et src/lib/friends.ts
 * qui l'utilisent pour exclure ces ids.
 *
 * Lève BlockCheckError en cas d'échec plutôt que de renvoyer `[]` — voir
 * ce type ci-dessus.
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) {
    throw new BlockCheckError(error.message);
  }
  if (!data) {
    throw new BlockCheckError('Réponse vide lors de la vérification des blocages.');
  }

  return data.map((row) => (row.blocker_id === userId ? row.blocked_id : row.blocker_id));
}

/** `true` si l'un des deux a bloqué l'autre, dans n'importe quel sens —
 * voir src/app/profile/[id].tsx (le profil d'un utilisateur bloqué n'est
 * plus consultable). Propage BlockCheckError comme getBlockedUserIds. */
export async function isBlockedEitherWay(userId: string, otherId: string): Promise<boolean> {
  const blockedIds = await getBlockedUserIds(userId);
  return blockedIds.includes(otherId);
}

export type BlockedUser = {
  id: string;
  prenom: string | null;
  photoUrl: string | null;
};

/** Utilisateurs que `userId` a bloqués lui-même (pas l'inverse) — pour la
 * section "Utilisateurs bloqués" de src/app/settings.tsx. `blocked_users`
 * a deux FK vers `users` (blocker_id et blocked_id), d'où le
 * `users!blocked_id(...)` pour désambiguïser la jointure — même pattern
 * que `sender:users!user_id(...)` dans src/lib/friends.ts. */
export async function getBlockedUsersList(userId: string): Promise<BlockedUser[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked:users!blocked_id(id, prenom, photo_url)')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as unknown as { blocked: BlockedUser | null }[])
    .map((row) => row.blocked)
    .filter((user): user is BlockedUser => user !== null);
}

/**
 * Bloque un utilisateur — voir src/app/profile/[id].tsx pour la
 * confirmation qui précède cet appel. La relation d'amitié existante
 * (le cas échéant) est supprimée automatiquement côté base (trigger
 * "on_block_created", voir la migration blocked_users) — rien à faire de
 * plus ici.
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error && error.code === '23505') {
    // Déjà bloqué (contrainte unique) : pas une vraie erreur pour l'UI.
    return { error: null };
  }

  return { error: error?.message ?? null };
}

/** Débloque un utilisateur (voir src/app/settings.tsx) — l'amitié n'est
 * pas restaurée automatiquement, il faudra renvoyer une demande. */
export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré." };
  }

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  return { error: error?.message ?? null };
}
