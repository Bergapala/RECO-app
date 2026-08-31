import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RecoCard } from '@/components/RecoCard';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { useSavedRecos } from '@/hooks/use-saved-recos';
import { getCurrentUserId } from '@/lib/auth';
import { getFriendshipStatus, sendFriendRequest, type FriendshipStatus } from '@/lib/friends';
import { goBack } from '@/lib/navigation';
import { fetchRecosByAuthor, type FeedReco } from '@/lib/recos';
import { getUserProfile, type UserProfile } from '@/lib/users';
import { theme } from '@/theme';

const BANNER_HEIGHT = 220;

const overlayTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

export default function FriendProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);
  const { onToggleSave } = useSavedRecos(setRecos, currentUserId);

  useEffect(() => {
    if (!id) return;

    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);

      const [userProfile, theirRecos] = await Promise.all([
        getUserProfile(id),
        fetchRecosByAuthor(id, userId),
      ]);
      setProfile(userProfile);
      setRecos(theirRecos);

      if (userId) {
        setFriendshipStatus(await getFriendshipStatus(userId, id));
      }

      setLoading(false);
    });
  }, [id]);

  async function handleAddFriend() {
    if (!currentUserId || !id || sendingRequest || friendshipStatus !== 'none') return;

    setSendingRequest(true);
    const { error } = await sendFriendRequest(currentUserId, id);
    setSendingRequest(false);

    if (!error) {
      setFriendshipStatus('pending');
    }
  }

  const initial = (profile?.prenom ?? '?').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={recos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <View style={styles.banner}>
                {profile?.photoUrl ? (
                  <Image source={{ uri: profile.photoUrl }} style={styles.bannerImage} />
                ) : (
                  <View style={[styles.bannerImage, styles.bannerFallback]}>
                    <Text style={styles.bannerInitial}>{initial}</Text>
                  </View>
                )}

                <LinearGradient
                  colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.7)']}
                  style={styles.bannerGradient}
                />

                <Pressable
                  onPress={() => goBack(router)}
                  hitSlop={12}
                  style={styles.bannerBackButton}>
                  <Feather name="arrow-left" size={22} color={theme.colors.text} />
                </Pressable>

                <View style={styles.bannerInfo}>
                  <Text style={[styles.bannerName, overlayTextShadow]}>
                    {profile?.prenom ?? 'Sans nom'}
                  </Text>
                  {profile?.username && (
                    <Text style={[styles.bannerUsername, overlayTextShadow]}>
                      @{profile.username}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.header}>
                {friendshipStatus === 'accepted' && (
                  <View style={[styles.friendButton, styles.friendButtonDisabled]}>
                    <Text style={styles.friendButtonTextDisabled}>Ami ✓</Text>
                  </View>
                )}

                {friendshipStatus === 'pending' && (
                  <View style={[styles.friendButton, styles.friendButtonDisabled]}>
                    <Text style={styles.friendButtonTextDisabled}>Demande envoyée ✓</Text>
                  </View>
                )}

                {friendshipStatus === 'none' && (
                  <Pressable
                    onPress={handleAddFriend}
                    disabled={sendingRequest}
                    style={[styles.friendButton, sendingRequest && styles.pressed]}>
                    <Text style={styles.friendButtonText}>Ajouter en ami</Text>
                  </Pressable>
                )}
              </View>
            </>
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
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune reco pour l&rsquo;instant</Text>
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
  listContent: {
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
  },
  banner: {
    height: BANNER_HEIGHT,
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerFallback: {
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_800ExtraBold`,
    fontSize: 72,
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_HEIGHT * 0.6,
  },
  bannerBackButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.lg,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInfo: {
    position: 'absolute',
    left: theme.spacing.lg,
    bottom: theme.spacing.md,
    gap: 2,
  },
  bannerName: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  bannerUsername: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  friendButton: {
    height: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendButtonDisabled: {
    borderColor: theme.colors.border,
  },
  friendButtonText: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  friendButtonTextDisabled: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.xl,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
  pressed: {
    opacity: 0.85,
  },
});
