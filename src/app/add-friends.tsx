import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getCurrentUserId } from '@/lib/auth';
import { searchUsersByName, sendFriendRequest, type UserSearchResult } from '@/lib/friends';
import { theme } from '@/theme';

const INVITE_MESSAGE =
  "Rejoins-moi sur RECO pour qu'on se partage nos meilleures découvertes ! recoapp://";

type RequestStatus = 'idle' | 'sending' | 'sent';

export default function AddFriendsScreen() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [requestStatus, setRequestStatus] = useState<Record<string, RequestStatus>>({});

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      searchUsersByName(trimmed, currentUserId).then((found) => {
        if (!cancelled) {
          setResults(found);
          setSearched(true);
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, currentUserId]);

  async function handleAddFriend(friendId: string) {
    if (!currentUserId || requestStatus[friendId]) return;

    setRequestStatus((current) => ({ ...current, [friendId]: 'sending' }));
    const { error } = await sendFriendRequest(currentUserId, friendId);
    setRequestStatus((current) => ({
      ...current,
      [friendId]: error ? 'idle' : 'sent',
    }));
  }

  async function handleInvite() {
    try {
      await Share.share({ message: INVITE_MESSAGE });
    } catch {
      // L'utilisateur a simplement annulé le partage — rien à faire.
    }
  }

  function handleContinue() {
    router.replace('/feed');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Ajoute tes amis</Text>
          <Text style={styles.subtitle}>Trouve tes amis par nom ou numéro de téléphone</Text>

          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={theme.colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un ami..."
              placeholderTextColor={theme.colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searched ? <Text style={styles.emptyText}>Aucun ami trouvé</Text> : null
          }
          renderItem={({ item }) => {
            const status = requestStatus[item.id] ?? 'idle';
            const initial = (item.prenom ?? '?').trim().charAt(0).toUpperCase();

            return (
              <View style={styles.resultRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>

                <Text style={styles.resultName}>{item.prenom ?? 'Sans nom'}</Text>

                <Pressable
                  onPress={() => handleAddFriend(item.id)}
                  disabled={status !== 'idle'}
                  style={[styles.addButton, status === 'sent' && styles.addButtonSent]}>
                  <Text
                    style={[
                      styles.addButtonText,
                      status === 'sent' && styles.addButtonTextSent,
                    ]}>
                    {status === 'sent' ? 'Demande envoyée ✓' : 'Ajouter'}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />

        <View style={styles.footer}>
          <View style={styles.separatorRow}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>ou</Text>
            <View style={styles.separatorLine} />
          </View>

          <Pressable
            onPress={handleInvite}
            style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}>
            <Text style={styles.inviteButtonText}>Inviter des amis</Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
            <Text style={styles.continueButtonText}>Continuer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    flexGrow: 1,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.md,
  },
  resultName: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.md,
  },
  addButton: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonSent: {
    borderColor: theme.colors.border,
  },
  addButtonText: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  addButtonTextSent: {
    color: theme.colors.muted,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  separatorText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  inviteButton: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  continueButton: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  pressed: {
    opacity: 0.85,
  },
});
