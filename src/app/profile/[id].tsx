import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RecoCard } from '@/components/RecoCard';
import { useTheme } from '@/context/ThemeContext';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { useSavedRecos } from '@/hooks/use-saved-recos';
import { getCurrentUserId } from '@/lib/auth';
import { blockUser, isBlockedEitherWay } from '@/lib/blocks';
import {
  getCompatibilityScore,
  getCompatibilitySubtitle,
  type CompatibilityScore,
} from '@/lib/compatibility';
import { getFriendshipStatus, sendFriendRequest, type FriendshipStatus } from '@/lib/friends';
import { goBack } from '@/lib/navigation';
import { fetchRecosByAuthor, type FeedReco } from '@/lib/recos';
import { getUserProfile, type UserProfile } from '@/lib/users';

const BANNER_HEIGHT = 220;

const overlayTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

export default function FriendProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [compatibility, setCompatibility] = useState<CompatibilityScore | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);
  const { onToggleSave } = useSavedRecos(setRecos, currentUserId);

  useEffect(() => {
    if (!id) return;

    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);

      // Un profil bloqué (dans un sens ou dans l'autre) n'est plus
      // consultable — on s'arrête là sans même charger ses recos, sa
      // compatibilité, etc. (voir le rendu "isBlocked" plus bas). En
      // pratique cet écran ne devrait plus être atteignable pour un
      // utilisateur bloqué (feed/recherche/amis l'excluent déjà), mais un
      // lien direct reste possible.
      if (userId) {
        const blocked = await isBlockedEitherWay(userId, id);
        if (blocked) {
          setIsBlocked(true);
          setLoading(false);
          return;
        }
      }

      const [userProfile, theirRecos] = await Promise.all([
        getUserProfile(id),
        fetchRecosByAuthor(id, userId),
      ]);
      setProfile(userProfile);
      setRecos(theirRecos);

      if (userId) {
        const [status, compat] = await Promise.all([
          getFriendshipStatus(userId, id),
          getCompatibilityScore(userId, id),
        ]);
        setFriendshipStatus(status);
        setCompatibility(compat);
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

  function handleBlock() {
    setMenuVisible(false);

    const name = profile?.prenom ?? 'cet utilisateur';
    Alert.alert(
      `Si tu bloques ${name}, vous ne verrez plus vos contenus respectifs`,
      undefined,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Bloquer', style: 'destructive', onPress: confirmBlock },
      ],
    );
  }

  async function confirmBlock() {
    if (!currentUserId || !id) return;

    const { error } = await blockUser(currentUserId, id);
    if (error) {
      Alert.alert('Erreur', error);
      return;
    }

    // Le profil n'est plus consultable une fois bloqué — retour à l'écran
    // précédent plutôt que de rester sur une page devenue obsolète.
    goBack(router);
  }

  function handleReportProfile() {
    setMenuVisible(false);
    // Volontairement une simple confirmation, sans modal de raisons ni
    // écriture en base (contrairement au signalement d'une reco) — voir
    // src/app/reco/[id].tsx pour ce flux plus détaillé.
    Alert.alert('Profil signalé, merci');
  }

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
        bannerMoreButton: {
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
          // couverture (avec dégradé sombre), pas sur le fond de l'app.
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
        compatCard: {
          width: '100%',
          marginTop: theme.spacing.md,
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.sm,
          gap: 2,
        },
        compatHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        compatTitle: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        compatScore: {
          color: theme.colors.accent,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.sm,
        },
        compatSubtitle: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.xs,
        },
        compatDetail: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.xs,
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
        moreMenu: {
          position: 'absolute',
          top: theme.spacing.sm + 32 + theme.spacing.xs,
          right: theme.spacing.lg,
          minWidth: 200,
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius.md,
          paddingVertical: theme.spacing.xs,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        },
        moreMenuItem: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        moreMenuItemText: {
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        moreMenuItemTextDestructive: {
          color: theme.colors.error,
        },
        moreMenuSeparator: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border,
        },
        blockedHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        blockedBackButton: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        blockedState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.lg,
        },
        blockedText: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
          textAlign: 'center',
        },
        pressed: {
          opacity: 0.85,
        },
      }),
    [theme],
  );

  if (isBlocked) {
    return (
      <View style={styles.container}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.blockedHeader}>
            <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.blockedBackButton}>
              <Feather name="arrow-left" size={22} color={theme.colors.text} />
            </Pressable>
          </View>
          <View style={styles.blockedState}>
            <Text style={styles.blockedText}>Ce profil n&rsquo;est plus disponible.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
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
                  {/* Blanc fixe : posé sur la bannière, pas sur le fond de l'app. */}
                  <Feather name="arrow-left" size={22} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  onPress={() => setMenuVisible(true)}
                  hitSlop={12}
                  style={styles.bannerMoreButton}>
                  <Feather name="more-horizontal" size={22} color="#FFFFFF" />
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

                {!loading && compatibility && (
                  <View style={styles.compatCard}>
                    <View style={styles.compatHeaderRow}>
                      <Text style={styles.compatTitle}>Compatibilité</Text>
                      <Text style={styles.compatScore}>{compatibility.score}%</Text>
                    </View>
                    <Text style={styles.compatSubtitle}>
                      {getCompatibilitySubtitle(compatibility)}
                    </Text>
                    <Text style={styles.compatDetail}>
                      {compatibility.commonCount} reco
                      {compatibility.commonCount > 1 ? 's' : ''} en commun sur{' '}
                      {compatibility.totalCount}
                    </Text>
                  </View>
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

        {menuVisible && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <View style={styles.moreMenu}>
              <Pressable
                onPress={handleBlock}
                style={({ pressed }) => [styles.moreMenuItem, pressed && styles.pressed]}>
                <Text style={[styles.moreMenuItemText, styles.moreMenuItemTextDestructive]}>
                  Bloquer {profile?.prenom ?? 'cet utilisateur'}
                </Text>
              </Pressable>
              <View style={styles.moreMenuSeparator} />
              <Pressable
                onPress={handleReportProfile}
                style={({ pressed }) => [styles.moreMenuItem, pressed && styles.pressed]}>
                <Text style={styles.moreMenuItemText}>Signaler ce profil</Text>
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
