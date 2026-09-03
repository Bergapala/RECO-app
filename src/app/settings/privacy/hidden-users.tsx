import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/context/ThemeContext';
import { goBack } from '@/lib/navigation';

// V2 — non implémenté. Schéma envisagé pour plus tard (à ne créer qu'au
// moment de construire la vraie fonctionnalité, pas maintenant) : une
// table hidden_users(hider_id, hidden_id, created_at), même forme que
// blocked_users (voir supabase/migrations/20260909090000_blocked_users.sql)
// MAIS sans le trigger de suppression d'amitié — masquer un ami ne doit
// pas casser la relation, contrairement à un blocage. Cet écran reste un
// simple "Bientôt disponible" tant que ces règles ne sont pas tranchées,
// pour ne pas afficher une liste/un toggle qui ne ferait rien de réel.
export default function HiddenUsersScreen() {
  const theme = useTheme();
  const router = useRouter();

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
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        backButton: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerTitle: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.md,
        },
        content: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
        badge: {
          fontSize: 40,
          marginBottom: theme.spacing.sm,
        },
        title: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.lg,
          textAlign: 'center',
        },
        body: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
          textAlign: 'center',
          lineHeight: theme.fontSizes.md * 1.4,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Utilisateurs masqués</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.content}>
          <Text style={styles.badge}>🙈</Text>
          <Text style={styles.title}>Bientôt disponible</Text>
          <Text style={styles.body}>
            Tu pourras bientôt masquer certains amis de ton feed sans les bloquer ni les
            prévenir — leurs recos n&rsquo;apparaîtront plus chez toi, mais votre amitié
            restera intacte.{'\n\n'}On te préviendra dès que c&rsquo;est prêt.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
