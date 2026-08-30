import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

type BottomTabBarProps = {
  active: 'feed' | 'profile';
};

/**
 * Bandeau de navigation inférieur — présent uniquement sur les deux écrans
 * "racine" de l'app (Feed et Mon profil), jamais sur les écrans secondaires
 * (détail reco, paramètres, notifications, ajout d'amis, liste d'amis...).
 * L'onglet actif est mis en avant en rouge accent et n'a pas d'action (on y
 * est déjà) ; l'autre est grisé et navigue vers son écran.
 */
export function BottomTabBar({ active }: BottomTabBarProps) {
  const router = useRouter();

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.bar}>
        <Pressable
          onPress={active === 'feed' ? undefined : () => router.push('/feed')}
          style={styles.button}>
          <Feather
            name="home"
            size={22}
            color={active === 'feed' ? theme.colors.accent : theme.colors.muted}
          />
        </Pressable>

        <Pressable onPress={() => router.push('/add-reco')} style={styles.addButton}>
          <Feather name="plus" size={26} color={theme.colors.text} />
        </Pressable>

        <Pressable
          onPress={active === 'profile' ? undefined : () => router.push('/profile')}
          style={styles.button}>
          <Feather
            name="user"
            size={22}
            color={active === 'profile' ? theme.colors.accent : theme.colors.muted}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  button: {
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
