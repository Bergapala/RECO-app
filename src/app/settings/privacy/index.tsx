import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { SettingsRow, SettingsSection } from '@/components/SettingsList';
import { useTheme } from '@/context/ThemeContext';
import { getCurrentUserId } from '@/lib/auth';
import { getContactsPermissionStatus, requestContactsPermission } from '@/lib/contacts';
import { goBack } from '@/lib/navigation';
import { getPrivacyPrefs, updatePrivacyPrefs } from '@/lib/users';

export default function PrivacySettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showFriendsToFriends, setShowFriendsToFriends] = useState(true);
  const [findableByPhone, setFindableByPhone] = useState(true);
  const [contactsGranted, setContactsGranted] = useState(false);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        const prefs = await getPrivacyPrefs(userId);
        setShowFriendsToFriends(prefs.showFriendsToFriends);
        setFindableByPhone(prefs.findableByPhone);
      }
    });
  }, []);

  // Re-vérifié à chaque retour sur cet écran, pas seulement au montage —
  // c'est ce qui permet de refléter un changement fait depuis les
  // Réglages iOS (voir handleToggleContacts, on ne peut pas révoquer par
  // code, seulement rediriger vers Réglages puis re-lire l'état réel).
  useFocusEffect(
    useCallback(() => {
      getContactsPermissionStatus().then((status) => setContactsGranted(status === 'granted'));
    }, []),
  );

  async function handleToggleShowFriends(value: boolean) {
    setShowFriendsToFriends(value);
    if (currentUserId) {
      await updatePrivacyPrefs(currentUserId, { showFriendsToFriends: value });
    }
  }

  async function handleToggleFindableByPhone(value: boolean) {
    setFindableByPhone(value);
    if (currentUserId) {
      await updatePrivacyPrefs(currentUserId, { findableByPhone: value });
    }
  }

  async function handleToggleContacts(value: boolean) {
    if (value) {
      const status = await requestContactsPermission();
      setContactsGranted(status === 'granted');
      return;
    }

    // iOS ne permet pas à une app de révoquer sa propre permission — la
    // seule option est de rediriger vers Réglages ; le useFocusEffect
    // ci-dessus capte le résultat réel au retour sur l'écran.
    Alert.alert(
      'Désactiver la synchronisation',
      "Pour désactiver l'accès à tes contacts, ouvre les réglages iOS de RECO.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ouvrir Réglages', onPress: () => Linking.openSettings() },
      ],
    );
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
          <Text style={styles.headerTitle}>Vie privée</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.content}>
          <SettingsSection>
            <SettingsRow
              label="Utilisateurs bloqués"
              onPress={() => router.push('/settings/privacy/blocked-users')}
            />
            <SettingsRow
              label="Utilisateurs masqués"
              onPress={() => router.push('/settings/privacy/hidden-users')}
              isLast
            />
          </SettingsSection>

          <SettingsSection>
            <SettingsRow
              label="Afficher mes amis à mes amis"
              accessory="switch"
              switchValue={showFriendsToFriends}
              onSwitchChange={handleToggleShowFriends}
            />
            <SettingsRow
              label="Être trouvé par numéro de téléphone"
              accessory="switch"
              switchValue={findableByPhone}
              onSwitchChange={handleToggleFindableByPhone}
            />
            <SettingsRow
              label="Synchroniser mes contacts"
              accessory="switch"
              switchValue={contactsGranted}
              onSwitchChange={handleToggleContacts}
              isLast
            />
          </SettingsSection>
        </View>
      </SafeAreaView>
    </View>
  );
}
