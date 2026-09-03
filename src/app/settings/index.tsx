import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { SettingsRow, SettingsSection } from '@/components/SettingsList';
import { useTheme } from '@/context/ThemeContext';
import {
  CONTACT_EMAIL,
  HELP_CENTER_URL,
  PRIVACY_POLICY_URL,
  RATE_APP_URL,
  TERMS_URL,
} from '@/config/links';
import { deleteAccount, signOut } from '@/lib/auth';
import { shareInvite } from '@/lib/invite';
import { goBack } from '@/lib/navigation';

/**
 * Hub principal des Paramètres — juste de la navigation vers les
 * sous-écrans (voir src/app/settings/*) et le mode sombre, qui n'a pas de
 * sous-menu naturel (c'est un réglage d'affichage global, pas une
 * catégorie de préférences). "Se déconnecter"/"Supprimer mon compte"
 * restent ici (voir la section AUTRES) — logique existante inchangée,
 * juste déplacée depuis l'ancien src/app/settings.tsx.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [deletingAccount, setDeletingAccount] = useState(false);

  function handleToggleDarkMode(value: boolean) {
    theme.setMode(value ? 'dark' : 'light');
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  /**
   * Confirmation en 2 étapes avant une action irréversible — chaque étape
   * son propre Alert plutôt qu'un seul avec plus de boutons, pour laisser
   * une vraie chance de revenir en arrière entre les deux.
   */
  function handleDeleteAccount() {
    if (deletingAccount) return;

    Alert.alert('Tu es sûr ? Cette action est irréversible.', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Continuer', style: 'destructive', onPress: confirmDeleteAccountStep2 },
    ]);
  }

  function confirmDeleteAccountStep2() {
    Alert.alert('Toutes tes données seront supprimées définitivement.', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: performDeleteAccount },
    ]);
  }

  async function performDeleteAccount() {
    if (deletingAccount) return;

    setDeletingAccount(true);
    const { error } = await deleteAccount();
    setDeletingAccount(false);

    if (error) {
      Alert.alert('Erreur', error);
      return;
    }

    router.replace('/login');
  }

  function handleContactEmail() {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`);
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
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.xl,
        },
        signOutButton: {
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
        },
        signOutText: {
          color: theme.colors.error,
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
        },
        deleteAccountSeparator: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border,
          marginTop: theme.spacing.md,
        },
        deleteAccountButton: {
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
        },
        deleteAccountText: {
          color: theme.colors.error,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SettingsSection>
            <SettingsRow
              label="🌙 Mode sombre"
              accessory="switch"
              switchValue={theme.mode === 'dark'}
              onSwitchChange={handleToggleDarkMode}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Profil">
            <SettingsRow
              label="Modifier le profil"
              onPress={() => router.push('/settings/edit-profile')}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Notifications">
            <SettingsRow
              label="Notifications"
              onPress={() => router.push('/settings/notifications')}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Vie privée">
            <SettingsRow
              label="Vie privée"
              onPress={() => router.push('/settings/privacy')}
              isLast
            />
          </SettingsSection>

          <View>
            <SettingsSection title="Autres">
              <SettingsRow
                label="Signaler un bug"
                onPress={() => router.push('/settings/report-bug')}
                isLast
              />
            </SettingsSection>

            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              <Text style={styles.signOutText}>Se déconnecter</Text>
            </Pressable>

            <View style={styles.deleteAccountSeparator} />

            <Pressable
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
              style={({ pressed }) => [styles.deleteAccountButton, pressed && styles.pressed]}>
              {deletingAccount ? (
                <ActivityIndicator color={theme.colors.error} />
              ) : (
                <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
              )}
            </Pressable>
          </View>

          <SettingsSection title="À propos">
            <SettingsRow label="Partager Reco" accessory="external" onPress={shareInvite} />
            <SettingsRow
              label="Noter Reco"
              accessory="external"
              onPress={() => Linking.openURL(RATE_APP_URL)}
            />
            <SettingsRow label="Nous contacter" accessory="external" onPress={handleContactEmail} />
            <SettingsRow
              label="Centre d'aide"
              accessory="external"
              onPress={() => Linking.openURL(HELP_CENTER_URL)}
            />
            <SettingsRow
              label="Demander un compte officiel"
              onPress={() => router.push('/settings/official-account')}
            />
            <SettingsRow
              label="Conditions générales"
              accessory="external"
              onPress={() => Linking.openURL(TERMS_URL)}
            />
            <SettingsRow
              label="Politique de confidentialité"
              accessory="external"
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              isLast
            />
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
