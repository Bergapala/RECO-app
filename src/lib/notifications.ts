import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type NotificationType = 'like' | 'new_reco' | 'reminder';

export type AppNotification = {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
  recoId: string | null;
  actor: {
    id: string;
    prenom: string | null;
    photoUrl: string | null;
  } | null;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  reco_id: string | null;
  actor: { id: string; prenom: string | null; photo_url: string | null } | null;
  recos: { titre: string } | null;
};

function buildMessage(row: NotificationRow): string {
  const actorName = row.actor?.prenom ?? 'Quelqu’un';

  switch (row.type) {
    case 'like':
      return `${actorName} a ❤️ ta reco ${row.recos?.titre ?? ''}`.trim();
    case 'new_reco':
      return `${actorName} a posté une nouvelle reco`;
    case 'reminder':
    default:
      return "Ça fait une semaine que tu n'as pas posté 🔴";
  }
}

function mapRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    message: buildMessage(row),
    read: row.read,
    createdAt: row.created_at,
    recoId: row.reco_id,
    actor: row.actor
      ? { id: row.actor.id, prenom: row.actor.prenom, photoUrl: row.actor.photo_url }
      : null,
  };
}

// `!actor_id` désambiguïse la jointure vers users : notifications a deux FK
// vers cette table (user_id le destinataire, actor_id qui a déclenché la
// notif), PostgREST a donc besoin de savoir laquelle utiliser ici.
const NOTIFICATION_SELECT =
  'id, type, read, created_at, reco_id, actor:users!actor_id(id, prenom, photo_url), recos(titre)';

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as unknown as NotificationRow[]).map(mapRow);
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  return count ?? 0;
}

export async function markAllAsRead(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

/** Abonnement Realtime pour rafraîchir le badge de la cloche en direct. */
export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
