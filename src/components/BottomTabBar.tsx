import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCurrentUserId } from '@/lib/auth';
import { getUnreadCount, subscribeToNotifications } from '@/lib/notifications';
import { getUserProfile } from '@/lib/users';
import { theme } from '@/theme';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState('?');
  const [hasUnread, setHasUnread] = useState(false);

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
              <Feather name="home" size={22} color={theme.colors.text} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/add-reco')}
              hitSlop={8}
              style={styles.button}>
              <Feather name="plus" size={22} color={theme.colors.text} />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(28, 28, 28, 0.85)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.sm,
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
    color: theme.colors.text,
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
    borderColor: theme.colors.background,
  },
});
