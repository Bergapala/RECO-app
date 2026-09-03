import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/context/ThemeContext';
import { deleteAccount, getCurrentUserId, signOut } from '@/lib/auth';
import { getBlockedUsersList, unblockUser, type BlockedUser } from '@/lib/blocks';
import { goBack } from '@/lib/navigation';
import { registerForPushNotifications } from '@/lib/push';
import { uploadProfilePhoto } from '@/lib/storage';
import {
  getNotificationPrefs,
  getUserProfile,
  updateNotificationPrefs,
  updatePhotoUrl,
  updatePrenom,
  type NotifHourSlot,
} from '@/lib/users';

const DAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Lun' },
  { value: 1, label: 'Mar' },
  { value: 2, label: 'Mer' },
  { value: 3, label: 'Jeu' },
  { value: 4, label: 'Ven' },
  { value: 5, label: 'Sam' },
  { value: 6, label: 'Dim' },
];

const HOUR_SLOTS: { value: NotifHourSlot; label: string }[] = [
  { value: '8-10', label: '8h-10h' },
  { value: '12-14', label: '12h-14h' },
  { value: '16-18', label: '16h-18h' },
  { value: '20-22', label: '20h-22h' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [prenom, setPrenom] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifDay, setNotifDay] = useState<number | null>(null);
  const [notifHour, setNotifHour] = useState<NotifHourSlot | null>(null);
  const [notifReactions, setNotifReactions] = useState(true);
  const [notifNewRecos, setNotifNewRecos] = useState(true);

  const [deletingAccount, setDeletingAccount] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        const [profile, prefs, blocked] = await Promise.all([
          getUserProfile(userId),
          getNotificationPrefs(userId),
          getBlockedUsersList(userId),
        ]);
        setPrenom(profile?.prenom ?? '');
        setPhotoUrl(profile?.photoUrl ?? null);
        setNotifEnabled(prefs.notifEnabled);
        setNotifDay(prefs.notifDay);
        setNotifHour(prefs.notifHour);
        setNotifReactions(prefs.notifReactions);
        setNotifNewRecos(prefs.notifNewRecos);
        setBlockedUsers(blocked);
      }
      hasLoadedRef.current = true;
    });
  }, []);

  // Sauvegarde auto du prénom, avec un léger debounce pour ne pas écrire à
  // chaque frappe. Ignore le tout premier passage (chargement initial).
  useEffect(() => {
    if (!hasLoadedRef.current || !currentUserId) return;

    const timeout = setTimeout(() => {
      updatePrenom(currentUserId, prenom.trim());
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prenom]);

  async function handleChangePhoto() {
    if (!currentUserId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    const uploadedUrl = await uploadProfilePhoto(currentUserId, result.assets[0].uri);
    setUploadingPhoto(false);

    if (uploadedUrl) {
      setPhotoUrl(uploadedUrl);
      await updatePhotoUrl(currentUserId, uploadedUrl);
    }
  }

  async function handleToggleEnabled(value: boolean) {
    setNotifEnabled(value);
    if (!currentUserId) return;
    await updateNotificationPrefs(currentUserId, { notifEnabled: value });
    if (value) {
      // Demande la permission et enregistre le token à l'activation — voir
      // src/lib/push.ts pour la limite (pas de projectId EAS configuré).
      registerForPushNotifications(currentUserId);
    }
  }

  async function handleSelectDay(day: number) {
    setNotifDay(day);
    if (currentUserId) await updateNotificationPrefs(currentUserId, { notifDay: day });
  }

  async function handleSelectHour(hour: NotifHourSlot) {
    setNotifHour(hour);
    if (currentUserId) await updateNotificationPrefs(currentUserId, { notifHour: hour });
  }

  async function handleToggleReactions(value: boolean) {
    setNotifReactions(value);
    if (currentUserId) await updateNotificationPrefs(currentUserId, { notifReactions: value });
  }

  async function handleToggleNewRecos(value: boolean) {
    setNotifNewRecos(value);
    if (currentUserId) await updateNotificationPrefs(currentUserId, { notifNewRecos: value });
  }

  function handleToggleDarkMode(value: boolean) {
    theme.setMode(value ? 'dark' : 'light');
  }

  async function handleUnblock(userId: string) {
    if (!currentUserId || unblockingId) return;

    setUnblockingId(userId);
    const { error } = await unblockUser(currentUserId, userId);
    setUnblockingId(null);

    if (error) {
      Alert.alert('Erreur', error);
      return;
    }

    setBlockedUsers((current) => current.filter((user) => user.id !== userId));
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

  const initial = prenom.trim().charAt(0).toUpperCase() || '?';

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
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.xl,
        },
        profileSection: {
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        avatarWrapper: {
          width: 80,
          height: 80,
        },
        avatar: {
          width: 80,
          height: 80,
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
          fontSize: theme.fontSizes.xl,
        },
        avatarEditBadge: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 26,
          height: 26,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.accent,
          borderWidth: 2,
          borderColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarHint: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.xs,
          marginBottom: theme.spacing.sm,
        },
        field: {
          width: '100%',
          gap: theme.spacing.xs,
        },
        fieldLabel: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.xs,
        },
        fieldInput: {
          height: 52,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.card,
          paddingHorizontal: theme.spacing.md,
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
        },
        section: {
          gap: theme.spacing.md,
        },
        sectionTitle: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.md,
        },
        prefRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        prefLabelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        prefBlock: {
          gap: theme.spacing.sm,
        },
        prefLabel: {
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        },
        chip: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 6,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        chipSelected: {
          backgroundColor: theme.colors.accent,
          borderColor: theme.colors.accent,
        },
        chipText: {
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.xs,
        },
        chipTextSelected: {
          // Blanc fixe, pas theme.colors.text : le fond de la puce
          // sélectionnée reste l'accent rouge quel que soit le mode.
          color: '#FFFFFF',
        },
        blockedEmptyText: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        blockedRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        blockedAvatar: {
          width: 40,
          height: 40,
          borderRadius: theme.borderRadius.full,
        },
        blockedAvatarInitial: {
          // Blanc fixe : le fond du cercle reste l'accent rouge quel que
          // soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.sm,
        },
        blockedName: {
          flex: 1,
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.sm,
        },
        unblockButton: {
          height: 36,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        unblockButtonText: {
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.xs,
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
          <View style={styles.profileSection}>
            <Pressable
              onPress={handleChangePhoto}
              disabled={uploadingPhoto}
              style={styles.avatarWrapper}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {/* Blanc fixe : le badge reste sur fond accent rouge. */}
                <Feather name="camera" size={14} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {uploadingPhoto ? 'Envoi en cours…' : 'Modifier la photo'}
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Prénom</Text>
              <TextInput
                value={prenom}
                onChangeText={setPrenom}
                placeholder="Ton prénom"
                placeholderTextColor={theme.colors.muted}
                style={styles.fieldInput}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Préférences</Text>

            <View style={styles.prefRow}>
              <View style={styles.prefLabelRow}>
                <Text style={styles.prefLabel}>🌙 Mode sombre</Text>
              </View>
              <Switch
                value={theme.mode === 'dark'}
                onValueChange={handleToggleDarkMode}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>Notifications activées</Text>
              <Switch
                value={notifEnabled}
                onValueChange={handleToggleEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.prefBlock}>
              <Text style={styles.prefLabel}>Jour du rappel hebdomadaire</Text>
              <View style={styles.chipRow}>
                {DAYS.map((day) => {
                  const selected = notifDay === day.value;
                  return (
                    <Pressable
                      key={day.value}
                      onPress={() => handleSelectDay(day.value)}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.prefBlock}>
              <Text style={styles.prefLabel}>Heure de réception</Text>
              <View style={styles.chipRow}>
                {HOUR_SLOTS.map((slot) => {
                  const selected = notifHour === slot.value;
                  return (
                    <Pressable
                      key={slot.value}
                      onPress={() => handleSelectHour(slot.value)}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {slot.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>Réactions</Text>
              <Switch
                value={notifReactions}
                onValueChange={handleToggleReactions}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>Nouvelles recos</Text>
              <Switch
                value={notifNewRecos}
                onValueChange={handleToggleNewRecos}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Utilisateurs bloqués</Text>

            {blockedUsers.length === 0 ? (
              <Text style={styles.blockedEmptyText}>Aucun utilisateur bloqué</Text>
            ) : (
              blockedUsers.map((user) => {
                const initial = (user.prenom ?? '?').trim().charAt(0).toUpperCase();
                return (
                  <View key={user.id} style={styles.blockedRow}>
                    {user.photoUrl ? (
                      <Image source={{ uri: user.photoUrl }} style={styles.blockedAvatar} />
                    ) : (
                      <View style={[styles.blockedAvatar, styles.avatarFallback]}>
                        <Text style={styles.blockedAvatarInitial}>{initial}</Text>
                      </View>
                    )}
                    <Text style={styles.blockedName}>{user.prenom ?? 'Sans nom'}</Text>
                    <Pressable
                      onPress={() => handleUnblock(user.id)}
                      disabled={unblockingId === user.id}
                      style={({ pressed }) => [styles.unblockButton, pressed && styles.pressed]}>
                      {unblockingId === user.id ? (
                        <ActivityIndicator size="small" color={theme.colors.text} />
                      ) : (
                        <Text style={styles.unblockButtonText}>Débloquer</Text>
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>

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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
