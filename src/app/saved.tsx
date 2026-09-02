import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RecoCard } from '@/components/RecoCard';
import { useTheme } from '@/context/ThemeContext';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { getCurrentUserId } from '@/lib/auth';
import { goBack } from '@/lib/navigation';
import type { FeedReco } from '@/lib/recos';
import { getSavedRecos, toggleSavedReco } from '@/lib/saved';

export default function SavedScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        setRecos(await getSavedRecos(userId));
      }
      setLoading(false);
    });
  }, []);

  // Sur cet écran, "désenregistrer" retire directement l'item de la liste
  // (c'est la liste des enregistrements) plutôt que de juste basculer
  // l'icône comme ailleurs — voir hooks/use-saved-recos.ts pour ce
  // comportement "toggle en place", utilisé partout où RecoCard apparaît
  // à côté d'autre contenu.
  async function handleToggleSave(reco: FeedReco) {
    if (!currentUserId) return;

    setRecos((current) => current.filter((item) => item.id !== reco.id));

    const { saved } = await toggleSavedReco(reco.id, currentUserId, true);
    if (saved) {
      // La suppression a échoué côté serveur : on la remet dans la liste.
      setRecos((current) => [reco, ...current]);
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
          fontSize: theme.fontSizes.xl,
        },
        listContent: {
          flexGrow: 1,
          paddingBottom: theme.spacing.xl,
        },
        emptyState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: theme.spacing.xxl,
          gap: theme.spacing.md,
        },
        emptyText: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
          textAlign: 'center',
          paddingHorizontal: theme.spacing.lg,
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
          <Text style={styles.headerTitle}>Mes enregistrements</Text>
          <View style={styles.backButton} />
        </View>

        <FlatList
          data={recos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <RecoCard
              reco={item}
              onToggleLike={onToggleLike}
              onToggleDiscovered={onToggleDiscovered}
              onToggleSave={handleToggleSave}
              currentUserId={currentUserId}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Feather name="bookmark" size={48} color={theme.colors.muted} />
                <Text style={styles.emptyText}>Tu n&rsquo;as rien enregistré pour l&rsquo;instant</Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}
