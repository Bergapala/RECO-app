import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { CONTACT_EMAIL } from '@/config/links';
import { useTheme } from '@/context/ThemeContext';
import { goBack } from '@/lib/navigation';

/**
 * Formulaire simple : le texte tapé devient le corps d'un email
 * pré-rempli vers CONTACT_EMAIL (Linking.openURL mailto:), envoyé via
 * l'app mail du téléphone — pas de table Supabase dédiée pour ça, même
 * mécanisme que "Nous contacter" (voir src/app/settings/index.tsx) et
 * "Demander un compte officiel".
 */
export default function ReportBugScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [message, setMessage] = useState('');

  function handleSend() {
    const trimmed = message.trim();
    if (trimmed.length === 0) return;

    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      'Signalement de bug — RECO',
    )}&body=${encodeURIComponent(trimmed)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir l'app mail sur cet appareil.");
    });
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
        flexFill: {
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
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        hint: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        input: {
          flex: 1,
          minHeight: 160,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.card,
          padding: theme.spacing.md,
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
        },
        button: {
          height: 52,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.lg,
        },
        buttonDisabled: {
          backgroundColor: theme.colors.border,
        },
        buttonText: {
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quel que soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
        },
        buttonTextDisabled: {
          color: theme.colors.muted,
        },
      }),
    [theme],
  );

  const isDisabled = message.trim().length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Signaler un bug</Text>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text style={styles.hint}>
              Décris ce qui ne fonctionne pas — on ouvre ton app mail avec ton message prêt à
              envoyer.
            </Text>

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Décris le problème rencontré..."
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              onPress={handleSend}
              disabled={isDisabled}
              style={[styles.button, isDisabled && styles.buttonDisabled]}>
              <Text style={[styles.buttonText, isDisabled && styles.buttonTextDisabled]}>
                Envoyer
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
