import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { getCurrentUserId } from '@/lib/auth';
import { getUnreadCount, subscribeToNotifications } from '@/lib/notifications';
import { getUserProfile } from '@/lib/users';

type BottomTabBarProps = {
  active: 'feed' | 'profile';
};

/** Marge à réserver en bas du contenu scrollable des écrans qui affichent
 * ce bandeau, pour que le dernier élément ne reste pas caché derrière la
 * pilule flottante. */
export const FLOATING_NAV_CLEARANCE = 100;

/**
 * Bandeau de navigation flottant — présent uniquement sur les deux écrans
 * "racine" de l'app (Feed et Mon profil), jamais sur les écrans secondaires
 * (détail reco, paramètres, notifications, ajout d'amis, liste d'amis...).
 * Flotte par-dessus le contenu (le scroll continue en dessous) plutôt que
 * d'être collé en bas de l'écran.
 */
export function BottomTabBar({ active }: BottomTabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState('?');
  const [hasUnread, setHasUnread] = useState(false);

  const plusScale = useRef(new Animated.Value(1)).current;

  function handlePlusPressIn() {
    Animated.spring(plusScale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
  }

  function handlePlusPressOut() {
    Animated.spring(plusScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  }

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (!userId) return;

      const [profile, unreadCount] = await Promise.all([
        getUserProfile(userId),
        getUnreadCount(userId),
      ]);
      setPhotoUrl(profile?.photoUrl ?? null);
      setInitial((profile?.prenom ?? '?').trim().charAt(0).toUpperCase());
      setHasUnread(unreadCount > 0);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeToNotifications(currentUserId, () => setHasUnread(true));
  }, [currentUserId]);

  // Le badge doit disparaître en revenant de l'écran notifications (qui
  // marque tout comme lu à l'ouverture) — un simple effet au montage ne
  // suffirait pas puisque Feed/Profil restent montés dans la pile.
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        getUnreadCount(currentUserId).then((count) => setHasUnread(count > 0));
      }
    }, [currentUserId]),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        floatingWrapper: {
          position: 'absolute',
          left: 0,
          right: 0,
          alignItems: 'center',
        },
        shadowWrapper: {
          width: '85%',
          borderRadius: 50,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        },
        pill: {
          borderRadius: 50,
          overflow: 'hidden',
        },
        tint: {
          // Cette pilule flottante garde volontairement un fond sombre fixe
          // (verre teinté) quel que soit le mode clair/sombre de l'app —
          // c'est pourquoi son contenu (icônes, initiale) ci-dessous reste
          // en couleurs claires fixes plutôt que theme.colors.text.
          backgroundColor: 'rgba(28, 28, 28, 0.85)',
        },
        content: {
          flexDirection: 'row',
          alignItems: 'center',
          // Seuls Accueil et Profil restent dans cette rangée — le bouton +
          // flotte au-dessus (voir plusWrapper), donc space-between les écarte
          // vers les bords plutôt que de laisser un vide au milieu.
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.sm,
        },
        button: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          borderRadius: 20,
        },
        buttonActive: {
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
        },
        plusWrapper: {
          position: 'absolute',
          // Remonte le cercle (60px) pour qu'il dépasse d'environ 18px au-dessus
          // du bandeau tout en chevauchant le reste de sa hauteur.
          top: -18,
          left: 0,
          right: 0,
          alignItems: 'center',
        },
        plusButton: {
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: theme.withOpacity(theme.colors.accent, 0.9),
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatar: {
          width: 28,
          height: 28,
          borderRadius: theme.borderRadius.full,
        },
        avatarFallback: {
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarInitial: {
          // Blanc fixe : le fond du cercle reste l'accent rouge quel que
          // soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.xs,
        },
        badge: {
          position: 'absolute',
          top: -1,
          right: -1,
          width: 9,
          height: 9,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.error,
          borderWidth: 1.5,
          // Fixe, pas theme.colors.background : le badge se découpe sur la
          // pilule flottante (toujours sombre), pas sur le fond de l'écran.
          borderColor: '#1C1C1C',
        },
      }),
    [theme],
  );

  return (
    <View style={[styles.floatingWrapper, { bottom: insets.bottom + theme.spacing.sm }]} pointerEvents="box-none">
      <View style={styles.shadowWrapper}>
        <View style={styles.pill}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />

          <View style={styles.content}>
            <Pressable
              onPress={active === 'feed' ? undefined : () => router.push('/feed')}
              hitSlop={8}
              style={[styles.button, active === 'feed' && styles.buttonActive]}>
              {/* Blanc fixe : icône posée sur la pilule toujours sombre. */}
              <Feather name="home" size={22} color="#F5F2EE" />
            </Pressable>

            <Pressable
              onPress={active === 'profile' ? undefined : () => router.push('/profile')}
              hitSlop={8}
              style={[styles.button, active === 'profile' && styles.buttonActive]}>
              <View>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}
                {hasUnread && <View style={styles.badge} />}
              </View>
            </Pressable>
          </View>
        </View>

        {/* Le bouton + dépasse volontairement du bandeau (plus grand que sa
           hauteur) — il doit donc être un sibling de `pill` plutôt qu'un
           enfant, sinon le `overflow: hidden` de `pill` (nécessaire pour
           clipper le blur en pilule) le couperait au ras du bord. */}
        <View style={styles.plusWrapper} pointerEvents="box-none">
          <Pressable
            onPress={() => router.push('/add-reco')}
            onPressIn={handlePlusPressIn}
            onPressOut={handlePlusPressOut}
            hitSlop={4}>
            <Animated.View style={[styles.plusButton, { transform: [{ scale: plusScale }] }]}>
              {/* Blanc fixe : le fond du bouton reste l'accent rouge. */}
              <Feather name="plus" size={theme.fontSizes.xxl} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
