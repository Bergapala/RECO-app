import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/context/ThemeContext';
import { getCurrentUserId } from '@/lib/auth';
import { getBlockedUsersList, unblockUser, type BlockedUser } from '@/lib/blocks';
import { goBack } from '@/lib/navigation';

/**
 * Liste + "Débloquer", déplacée telle quelle depuis l'ancien
 * src/app/settings.tsx dans son propre écran (voir
 * src/app/settings/privacy/index.tsx pour le point d'entrée).
 */
export default function BlockedUsersScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        setBlockedUsers(await getBlockedUsersList(userId));
      }
    });
  }, []);

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
          gap: theme.spacing.md,
        },
        emptyText: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        avatar: {
          width: 40,
          height: 40,
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
          fontSize: theme.fontSizes.sm,
        },
        name: {
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
          <Text style={styles.headerTitle}>Utilisateurs bloqués</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.content}>
          {blockedUsers.length === 0 ? (
            <Text style={styles.emptyText}>Aucun utilisateur bloqué</Text>
          ) : (
            blockedUsers.map((user) => {
              const initial = (user.prenom ?? '?').trim().charAt(0).toUpperCase();
              return (
                <View key={user.id} style={styles.row}>
                  {user.photoUrl ? (
                    <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                  )}
                  <Text style={styles.name}>{user.prenom ?? 'Sans nom'}</Text>
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
      </SafeAreaView>
    </View>
  );
}
