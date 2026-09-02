import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomTabBar, FLOATING_NAV_CLEARANCE } from '@/components/BottomTabBar';
import { RecoCard } from '@/components/RecoCard';
import { useTheme } from '@/context/ThemeContext';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { useSavedRecos } from '@/hooks/use-saved-recos';
import { getCurrentUserId } from '@/lib/auth';
import { shareInvite } from '@/lib/invite';
import { getUnreadCount, subscribeToNotifications } from '@/lib/notifications';
import { fetchFeedRecos, type FeedReco } from '@/lib/recos';
import { getProfileStats } from '@/lib/users';

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendCount, setFriendCount] = useState<number | null>(null);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);
  const { onToggleSave } = useSavedRecos(setRecos, currentUserId);

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
        setFriendCount((await getProfileStats(userId)).friendCount);
      }
    });
  }, [loadFeed]);

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeToNotifications(currentUserId, () => {
      setUnreadCount((count) => count + 1);
    });
  }, [currentUserId]);

  // Rafraîchit le badge et le nombre d'amis en revenant sur le feed (les
  // notifs sont marquées lues à l'ouverture de cet écran-là, et le nombre
  // d'amis peut avoir changé après un passage par l'écran Ajout d'amis).
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        getUnreadCount(currentUserId).then(setUnreadCount);
        getProfileStats(currentUserId).then((stats) => setFriendCount(stats.friendCount));
      }
    }, [currentUserId]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadFeed(currentUserId);
    if (currentUserId) {
      setFriendCount((await getProfileStats(currentUserId)).friendCount);
    }
    setRefreshing(false);
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          paddingBottom: FLOATING_NAV_CLEARANCE,
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
        emptyIcon: {
          fontSize: 56,
          opacity: 0.6,
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
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quel que soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
        },
        emptySecondaryButton: {
          height: 52,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1.5,
          borderColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptySecondaryButtonText: {
          color: theme.colors.accent,
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
        },
        emptySkipText: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.sm,
        },
        pressed: {
          opacity: 0.85,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
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
              onToggleSave={onToggleSave}
              currentUserId={currentUserId}
            />
          )}
          ListEmptyComponent={
            !loading && friendCount !== null ? (
              friendCount === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>👋</Text>
                  <Text style={styles.emptyText}>
                    Ajoute des amis pour voir leurs recos apparaître ici
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/add-friends', params: { autoSync: '1' } })
                    }
                    style={({ pressed }) => [styles.emptySecondaryButton, pressed && styles.pressed]}>
                    <Text style={styles.emptySecondaryButtonText}>Synchroniser mes contacts</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/add-friends')}
                    style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
                    <Text style={styles.emptyButtonText}>Ajouter des amis</Text>
                  </Pressable>
                  <Pressable
                    onPress={shareInvite}
                    style={({ pressed }) => [styles.emptySecondaryButton, pressed && styles.pressed]}>
                    <Text style={styles.emptySecondaryButtonText}>Inviter des amis</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      // Ne fait rien de spécial : reste simplement sur le
                      // feed vide, sans naviguer ailleurs.
                    }}
                    hitSlop={8}>
                    <Text style={styles.emptySkipText}>Passer</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Tes amis n&rsquo;ont pas encore posté 👀</Text>
                  <Pressable
                    onPress={() => router.push('/add-reco')}
                    style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
                    <Text style={styles.emptyButtonText}>Être le premier à poster</Text>
                  </Pressable>
                </View>
              )
            ) : null
          }
        />
      </SafeAreaView>

      <BottomTabBar active="feed" />
    </View>
  );
}
