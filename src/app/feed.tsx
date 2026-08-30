import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RecoCard } from '@/components/RecoCard';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { getCurrentUserId } from '@/lib/auth';
import { getUnreadCount, subscribeToNotifications } from '@/lib/notifications';
import { fetchFeedRecos, type FeedReco } from '@/lib/recos';
import { theme } from '@/theme';

export default function FeedScreen() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);

  const loadFeed = useCallback(async (userId: string | null) => {
    const feed = await fetchFeedRecos(userId);
    setRecos(feed);
  }, []);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      await loadFeed(userId);
      setLoading(false);
      if (userId) {
        setUnreadCount(await getUnreadCount(userId));
      }
    });
  }, [loadFeed]);

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeToNotifications(currentUserId, () => {
      setUnreadCount((count) => count + 1);
    });
  }, [currentUserId]);

  // Rafraîchit le badge en revenant de l'écran Notifications (elles y sont
  // marquées comme lues à l'ouverture).
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        getUnreadCount(currentUserId).then(setUnreadCount);
      }
    }, [currentUserId]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadFeed(currentUserId);
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Text style={styles.logo}>RECO</Text>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={12} style={styles.bellButton}>
            <Feather name="bell" size={22} color={theme.colors.text} />
            {unreadCount > 0 && <View style={styles.badge} />}
          </Pressable>
        </View>

        <FlatList
          data={recos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
            />
          }
          renderItem={({ item }) => (
            <RecoCard
              reco={item}
              onToggleLike={onToggleLike}
              onToggleDiscovered={onToggleDiscovered}
              currentUserId={currentUserId}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Tes amis n&rsquo;ont pas encore posté 👀</Text>
                <Pressable
                  onPress={() => router.push('/add-reco')}
                  style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
                  <Text style={styles.emptyButtonText}>Être le premier à poster</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBarSafeArea}>
        <View style={styles.bottomBar}>
          <Pressable style={styles.bottomBarButton}>
            <Feather name="home" size={22} color={theme.colors.accent} />
          </Pressable>

          <Pressable onPress={() => router.push('/add-reco')} style={styles.addButton}>
            <Feather name="plus" size={26} color={theme.colors.text} />
          </Pressable>

          <Pressable onPress={() => router.push('/profile')} style={styles.bottomBarButton}>
            <Feather name="user" size={22} color={theme.colors.muted} />
          </Pressable>
        </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  logo: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontTitle}_800ExtraBold`,
    fontSize: theme.fontSizes.xl,
    letterSpacing: 1,
  },
  bellButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.error,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  listContent: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
    textAlign: 'center',
  },
  emptyButton: {
    height: 52,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  pressed: {
    opacity: 0.85,
  },
  bottomBarSafeArea: {
    backgroundColor: theme.colors.background,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  bottomBarButton: {
    padding: theme.spacing.sm,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
