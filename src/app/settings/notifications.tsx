import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { SettingsRow, SettingsSection } from '@/components/SettingsList';
import { useTheme } from '@/context/ThemeContext';
import { getCurrentUserId } from '@/lib/auth';
import { goBack } from '@/lib/navigation';
import { registerForPushNotifications } from '@/lib/push';
import { getNotificationPrefs, updateNotificationPrefs, type NotifHourSlot } from '@/lib/users';

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

export default function NotificationsSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifDay, setNotifDay] = useState<number | null>(null);
  const [notifHour, setNotifHour] = useState<NotifHourSlot | null>(null);
  const [notifReactions, setNotifReactions] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifNewRecos, setNotifNewRecos] = useState(true);
  const [notifFriendRequests, setNotifFriendRequests] = useState(true);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        const prefs = await getNotificationPrefs(userId);
        setNotifEnabled(prefs.notifEnabled);
        setNotifDay(prefs.notifDay);
        setNotifHour(prefs.notifHour);
        setNotifReactions(prefs.notifReactions);
        setNotifComments(prefs.notifComments);
        setNotifNewRecos(prefs.notifNewRecos);
        setNotifFriendRequests(prefs.notifFriendRequests);
      }
    });
  }, []);

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

  async function handleToggleComments(value: boolean) {
    setNotifComments(value);
    if (currentUserId) await updateNotificationPrefs(currentUserId, { notifComments: value });
  }

  async function handleToggleNewRecos(value: boolean) {
    setNotifNewRecos(value);
    if (currentUserId) await updateNotificationPrefs(currentUserId, { notifNewRecos: value });
  }

  async function handleToggleFriendRequests(value: boolean) {
    setNotifFriendRequests(value);
    if (currentUserId) {
      await updateNotificationPrefs(currentUserId, { notifFriendRequests: value });
    }
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
        frequencyBlock: {
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
        },
        frequencyLabel: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.xs,
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
          backgroundColor: theme.colors.background,
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
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.content}>
          <SettingsSection>
            <SettingsRow
              label="Notifications activées"
              accessory="switch"
              switchValue={notifEnabled}
              onSwitchChange={handleToggleEnabled}
              isLast
            />
          </SettingsSection>

          <View style={styles.frequencyBlock}>
            <Text style={styles.frequencyLabel}>Fréquence des notifications hebdomadaires</Text>

            <Text style={styles.frequencyLabel}>Jour du rappel</Text>
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

            <Text style={styles.frequencyLabel}>Heure de réception</Text>
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

          <SettingsSection>
            <SettingsRow
              label="Réactions ❤️ 👀"
              accessory="switch"
              switchValue={notifReactions}
              onSwitchChange={handleToggleReactions}
            />
            <SettingsRow
              label="Commentaires 💬"
              accessory="switch"
              switchValue={notifComments}
              onSwitchChange={handleToggleComments}
            />
            <SettingsRow
              label="Nouvelles recos des amis"
              accessory="switch"
              switchValue={notifNewRecos}
              onSwitchChange={handleToggleNewRecos}
            />
            <SettingsRow
              label="Demandes d'amis"
              accessory="switch"
              switchValue={notifFriendRequests}
              onSwitchChange={handleToggleFriendRequests}
              isLast
            />
          </SettingsSection>
        </View>
      </SafeAreaView>
    </View>
  );
}
