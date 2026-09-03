import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { CONTACT_EMAIL } from '@/config/links';
import { useTheme } from '@/context/ThemeContext';
import { goBack } from '@/lib/navigation';

/** Page simple explicative, pas de backend — même mécanisme mailto que
 * "Signaler un bug" et "Nous contacter". */
export default function OfficialAccountScreen() {
  const theme = useTheme();
  const router = useRouter();

  function handleWriteEmail() {
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      'Demande de compte officiel',
    )}`;
    Linking.openURL(url);
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
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          gap: theme.spacing.md,
        },
        title: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.lg,
        },
        body: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
          lineHeight: theme.fontSizes.md * 1.5,
        },
        emailHighlight: {
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_600SemiBold`,
        },
        button: {
          height: 52,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: theme.spacing.sm,
        },
        buttonText: {
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quel que soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
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
          <Text style={styles.headerTitle}>Compte officiel</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Marques, créateurs, médias</Text>
          <Text style={styles.body}>
            Les comptes officiels sont réservés aux marques, créateurs et médias qui veulent
            partager leurs recos avec leur communauté sur RECO.
          </Text>
          <Text style={styles.body}>
            Pour l&rsquo;instant, cette demande se fait directement par email : écris-nous à{' '}
            <Text style={styles.emailHighlight}>{CONTACT_EMAIL}</Text> en précisant le nom de
            la structure et un lien vers un compte existant (réseau social, site...)
            permettant de vérifier ton identité.
          </Text>

          <Pressable onPress={handleWriteEmail} style={styles.button}>
            <Text style={styles.buttonText}>Nous écrire</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
