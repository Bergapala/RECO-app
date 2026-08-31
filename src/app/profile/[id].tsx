import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RecoCard } from '@/components/RecoCard';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { getCurrentUserId } from '@/lib/auth';
import { getFriendshipStatus, sendFriendRequest, type FriendshipStatus } from '@/lib/friends';
import { goBack } from '@/lib/navigation';
import { fetchRecosByAuthor, type FeedReco } from '@/lib/recos';
import { getUserProfile, type UserProfile } from '@/lib/users';
import { theme } from '@/theme';

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
            <View style={styles.header}>
              <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.backButton}>
                <Feather name="arrow-left" size={22} color={theme.colors.text} />
              </Pressable>

              {profile?.photoUrl ? (
                <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}

              <Text style={styles.name}>{profile?.prenom ?? 'Sans nom'}</Text>
              {profile?.username && <Text style={styles.username}>@{profile.username}</Text>}

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
  header: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  backButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.lg,
    padding: theme.spacing.xs,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.lg,
  },
  avatarFallback: {
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  name: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
    marginTop: theme.spacing.sm,
  },
  username: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
  friendButton: {
    marginTop: theme.spacing.sm,
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
