import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BottomTabBar, FLOATING_NAV_CLEARANCE } from '@/components/BottomTabBar';
import { RecoCard } from '@/components/RecoCard';
import { useTheme } from '@/context/ThemeContext';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { useSavedRecos } from '@/hooks/use-saved-recos';
import { getCurrentUserId } from '@/lib/auth';
import { fetchRecosByAuthor, type FeedReco } from '@/lib/recos';
import { getSavedRecoCount } from '@/lib/saved';
import { getProfileStats, getUserProfile, type ProfileStats, type UserProfile } from '@/lib/users';

const BANNER_HEIGHT = 220;

const overlayTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ recoCount: 0, friendCount: 0 });
  const [savedCount, setSavedCount] = useState(0);
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);
  const { onToggleSave } = useSavedRecos(setRecos, currentUserId);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        const [userProfile, profileStats, myRecos, savedRecoCount] = await Promise.all([
          getUserProfile(userId),
          getProfileStats(userId),
          fetchRecosByAuthor(userId, userId),
          getSavedRecoCount(userId),
        ]);
        setProfile(userProfile);
        setStats(profileStats);
        setRecos(myRecos);
        setSavedCount(savedRecoCount);
      }
      setLoading(false);
    });
  }, []);

  const initial = (profile?.prenom ?? '?').trim().charAt(0).toUpperCase();

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
        listContent: {
          paddingBottom: FLOATING_NAV_CLEARANCE,
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
          // Blanc fixe : le fond de repli reste l'accent rouge quel que
          // soit le mode clair/sombre.
          color: '#FFFFFF',
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
        bannerSettingsButton: {
          position: 'absolute',
          top: theme.spacing.sm,
          right: theme.spacing.lg,
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
          // Blanc fixe, pas theme.colors.text : posé sur la photo de
          // couverture (avec dégradé sombre), pas sur le fond de l'app —
          // doit rester lisible dans les deux modes.
          color: '#FFFFFF',
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.xl,
        },
        bannerUsername: {
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        header: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          gap: theme.spacing.md,
        },
        statsRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: theme.spacing.xl,
        },
        statBlock: {
          alignItems: 'center',
        },
        statNumber: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.xxl,
        },
        statLabel: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.xs,
          marginTop: 2,
        },
        savedBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
        },
        savedBannerText: {
          flex: 1,
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_500Medium`,
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
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quel que soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
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
                  onPress={() => router.back()}
                  hitSlop={12}
                  style={styles.bannerBackButton}>
                  {/* Blanc fixe : posé sur la bannière, pas sur le fond de l'app. */}
                  <Feather name="arrow-left" size={22} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  onPress={() => router.push('/settings')}
                  hitSlop={12}
                  style={styles.bannerSettingsButton}>
                  <Feather name="settings" size={22} color="#FFFFFF" />
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
                <View style={styles.statsRow}>
                  <View style={styles.statBlock}>
                    <Text style={styles.statNumber}>{stats.recoCount}</Text>
                    <Text style={styles.statLabel}>reco{stats.recoCount > 1 ? 's' : ''}</Text>
                  </View>

                  <Pressable
                    onPress={() => router.push('/friends')}
                    hitSlop={8}
                    style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}>
                    <Text style={styles.statNumber}>{stats.friendCount}</Text>
                    <Text style={styles.statLabel}>ami{stats.friendCount > 1 ? 's' : ''}</Text>
                  </Pressable>

                  <View style={styles.statBlock}>
                    <Text style={styles.statNumber}>🔥 {profile?.streakCount ?? 0}</Text>
                    <Text style={styles.statLabel}>
                      semaine{(profile?.streakCount ?? 0) > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => router.push('/saved')}
                  style={({ pressed }) => [styles.savedBanner, pressed && styles.pressed]}>
                  <Feather name="bookmark" size={20} color={theme.colors.text} />
                  <Text style={styles.savedBannerText}>
                    Mes enregistrements ({savedCount})
                  </Text>
                  <Feather name="chevron-right" size={20} color={theme.colors.muted} />
                </Pressable>
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

      <BottomTabBar active="profile" />
    </View>
  );
}
