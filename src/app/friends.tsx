import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { FriendSearchPanel } from '@/components/FriendSearchPanel';
import { useTheme } from '@/context/ThemeContext';
import { getCurrentUserId } from '@/lib/auth';
import { getFriendsList, removeFriend, type FriendListItem } from '@/lib/friends';
import { goBack } from '@/lib/navigation';

function formatAddedAt(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

export default function FriendsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const loadFriends = useCallback(async (userId: string | null) => {
    if (!userId) return;
    setFriends(await getFriendsList(userId));
  }, []);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      await loadFriends(userId);
      setLoading(false);
    });
  }, [loadFriends]);

  function handleRemove(friend: FriendListItem) {
    Alert.alert(`Tu veux vraiment retirer ${friend.prenom ?? 'cet ami'} ?`, undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          if (!currentUserId) return;
          const { error } = await removeFriend(currentUserId, friend.id);
          if (!error) {
            setFriends((current) => current.filter((item) => item.id !== friend.id));
          }
        },
      },
    ]);
  }

  function closeModal() {
    setModalVisible(false);
    // Le modal a pu servir à envoyer des demandes qui viennent d'être
    // acceptées ailleurs entre-temps — pas la peine de recharger la liste
    // dans ce cas précis (les demandes en attente n'apparaissent pas ici),
    // donc rien de plus à faire qu'à fermer le modal.
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
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        },
        headerButton: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.lg,
        },
        listContent: {
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
          flexGrow: 1,
        },
        friendRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.background,
        },
        avatar: {
          width: 44,
          height: 44,
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
          fontSize: theme.fontSizes.md,
        },
        friendInfo: {
          gap: 2,
        },
        friendName: {
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.md,
        },
        friendSince: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.xs,
        },
        removeAction: {
          width: 88,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.error,
        },
        removeActionText: {
          // Blanc fixe : le fond de cette action reste rouge erreur quel
          // que soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.sm,
        },
        emptyState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: theme.spacing.xxl,
          gap: theme.spacing.lg,
        },
        emptyText: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
          textAlign: 'center',
        },
        emptyButton: {
          height: 52,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptyButtonText: {
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quel que soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
        },
        pressed: {
          opacity: 0.85,
        },
        modalContainer: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        modalSafeArea: {
          flex: 1,
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        },
        modalTitle: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.lg,
        },
        modalPanelWrapper: {
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.headerButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>

          <Text style={styles.title}>Mes amis</Text>

          <Pressable
            onPress={() => setModalVisible(true)}
            hitSlop={12}
            style={styles.headerButton}>
            <Feather name="user-plus" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const initial = (item.prenom ?? '?').trim().charAt(0).toUpperCase();

            return (
              <Swipeable
                renderRightActions={() => (
                  <Pressable
                    onPress={() => handleRemove(item)}
                    style={styles.removeAction}>
                    <Text style={styles.removeActionText}>Retirer</Text>
                  </Pressable>
                )}>
                <Pressable
                  onPress={() => router.push(`/profile/${item.id}`)}
                  style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                  )}

                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{item.prenom ?? 'Sans nom'}</Text>
                    <Text style={styles.friendSince}>Ami depuis le {formatAddedAt(item.addedAt)}</Text>
                  </View>
                </Pressable>
              </Swipeable>
            );
          }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Tu n&rsquo;as pas encore d&rsquo;amis</Text>
                <Pressable
                  onPress={() => setModalVisible(true)}
                  style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
                  <Text style={styles.emptyButtonText}>Ajouter des amis</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      </SafeAreaView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter des amis</Text>
              <Pressable onPress={closeModal} hitSlop={12} style={styles.headerButton}>
                <Feather name="x" size={22} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.modalPanelWrapper}>
              <FriendSearchPanel currentUserId={currentUserId} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
