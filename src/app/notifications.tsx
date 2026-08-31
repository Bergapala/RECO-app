import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getCurrentUserId } from '@/lib/auth';
import {
  acceptFriendRequest,
  declineFriendRequest,
  getPendingFriendRequests,
  type PendingFriendRequest,
} from '@/lib/friends';
import { goBack } from '@/lib/navigation';
import {
  fetchNotifications,
  markAllAsRead,
  type AppNotification,
} from '@/lib/notifications';
import { theme } from '@/theme';

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;

  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      if (!userId) {
        setLoading(false);
        return;
      }

      const [list, requests] = await Promise.all([
        fetchNotifications(userId),
        getPendingFriendRequests(userId),
      ]);
      setNotifications(list);
      setPendingRequests(requests);
      setLoading(false);

      // Marquées comme lues automatiquement à l'ouverture — en arrière-plan,
      // pour ne pas changer visuellement ce qu'on vient d'afficher.
      markAllAsRead(userId);
    });
  }, []);

  async function handleAcceptRequest(request: PendingFriendRequest) {
    if (respondingId) return;
    setRespondingId(request.id);
    const { error } = await acceptFriendRequest(request.id);
    setRespondingId(null);
    if (!error) {
      setPendingRequests((current) => current.filter((item) => item.id !== request.id));
    }
  }

  async function handleDeclineRequest(request: PendingFriendRequest) {
    if (respondingId) return;
    setRespondingId(request.id);
    const { error } = await declineFriendRequest(request.id);
    setRespondingId(null);
    if (!error) {
      setPendingRequests((current) => current.filter((item) => item.id !== request.id));
    }
  }

  function handlePress(notification: AppNotification) {
    if (notification.type === 'reminder') {
      router.push('/add-reco');
      return;
    }

    if (notification.recoId) {
      router.push(`/reco/${notification.recoId}`);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.backButton} />
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            pendingRequests.length > 0 ? (
              <View style={styles.requestsSection}>
                <Text style={styles.requestsTitle}>Demandes d&rsquo;amis</Text>

                {pendingRequests.map((request) => (
                  <View key={request.id} style={styles.requestRow}>
                    {request.sender.photoUrl ? (
                      <Image source={{ uri: request.sender.photoUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitial}>
                          {(request.sender.prenom ?? '?').trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.requestBody}>
                      <Text style={styles.requestText}>
                        <Text style={styles.requestName}>
                          {request.sender.prenom ?? 'Sans nom'}
                        </Text>{' '}
                        veut t&rsquo;ajouter en ami
                      </Text>

                      <View style={styles.requestActions}>
                        <Pressable
                          onPress={() => handleAcceptRequest(request)}
                          disabled={respondingId === request.id}
                          style={[
                            styles.acceptButton,
                            respondingId === request.id && styles.pressed,
                          ]}>
                          <Text style={styles.acceptButtonText}>Accepter</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleDeclineRequest(request)}
                          disabled={respondingId === request.id}
                          style={[
                            styles.declineButton,
                            respondingId === request.id && styles.pressed,
                          ]}>
                          <Text style={styles.declineButtonText}>Refuser</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}

                <View style={styles.requestsSeparator} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              style={[styles.row, !item.read && styles.rowUnread]}>
              {item.actor?.photoUrl ? (
                <Image source={{ uri: item.actor.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {item.type === 'reminder'
                      ? '🔔'
                      : (item.actor?.prenom ?? '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.rowBody}>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.date}>{formatRelativeDate(item.createdAt)}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>Pas encore de notifications</Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  requestsSection: {
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  requestsTitle: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.md,
    paddingHorizontal: theme.spacing.lg,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  requestBody: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  requestText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
  requestName: {
    fontFamily: `${theme.fontBody}_600SemiBold`,
  },
  requestActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  acceptButton: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  declineButton: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    color: theme.colors.error,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  requestsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  rowUnread: {
    backgroundColor: theme.colors.card,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
  },
  avatarFallback: {
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  message: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
  date: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    fontSize: 64,
    opacity: 0.5,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
    textAlign: 'center',
  },
});
