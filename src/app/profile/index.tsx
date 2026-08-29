import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RecoCard } from '@/components/RecoCard';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { getCurrentUserId } from '@/lib/auth';
import { fetchRecosByAuthor, type FeedReco } from '@/lib/recos';
import { getProfileStats, getUserProfile, type ProfileStats, type UserProfile } from '@/lib/users';
import { theme } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ recoCount: 0, friendCount: 0 });
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        const [userProfile, profileStats, myRecos] = await Promise.all([
          getUserProfile(userId),
          getProfileStats(userId),
          fetchRecosByAuthor(userId, userId),
        ]);
        setProfile(userProfile);
        setStats(profileStats);
        setRecos(myRecos);
      }
      setLoading(false);
    });
  }, []);

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
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={12}
                style={styles.settingsButton}>
                <Feather name="settings" size={22} color={theme.colors.text} />
              </Pressable>

              {profile?.photoUrl ? (
                <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}

              <Text style={styles.name}>{profile?.prenom ?? 'Sans nom'}</Text>

              <Text style={styles.stats}>
                {stats.recoCount} reco{stats.recoCount > 1 ? 's' : ''} · {stats.friendCount} ami
                {stats.friendCount > 1 ? 's' : ''}
              </Text>
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
                <Text style={styles.emptyText}>Tu n&rsquo;as pas encore posté de reco</Text>
                <Pressable
                  onPress={() => router.push('/add-reco')}
                  style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
                  <Text style={styles.emptyButtonText}>Ajouter ma première reco</Text>
                </Pressable>
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
  settingsButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.lg,
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
  stats: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
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
});
