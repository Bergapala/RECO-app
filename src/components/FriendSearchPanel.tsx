import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { findContactsOnReco, type ContactMatch } from '@/lib/contacts';
import { searchUsersByName, sendFriendRequest, type UserSearchResult } from '@/lib/friends';
import { shareInvite } from '@/lib/invite';
import { theme } from '@/theme';

type RequestStatus = 'idle' | 'sending' | 'sent';
type ContactsSyncState = 'idle' | 'syncing' | 'denied' | 'done';

type FriendSearchPanelProps = {
  currentUserId: string | null;
  /** Lance automatiquement la synchronisation des contacts au montage
   * (ex. venant du bouton "Synchroniser mes contacts" de l'état vide du
   * feed). */
  autoSync?: boolean;
};

/**
 * Bloc réutilisable "recherche + synchronisation contacts + invitation" —
 * utilisé à la fois par l'écran Ajout d'amis (src/app/add-friends.tsx) et
 * par le modal d'ajout de l'écran Mes amis (src/app/friends.tsx), pour ne
 * pas dupliquer cette logique aux deux endroits.
 */
export function FriendSearchPanel({ currentUserId, autoSync }: FriendSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([]);
  const [contactsSyncState, setContactsSyncState] = useState<ContactsSyncState>('idle');

  const [requestStatus, setRequestStatus] = useState<Record<string, RequestStatus>>({});

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

  async function handleSyncContacts() {
    if (contactsSyncState === 'syncing') return;

    setContactsSyncState('syncing');
    const matches = await findContactsOnReco(currentUserId);

    if (matches === null) {
      setContactsSyncState('denied');
      return;
    }

    setContactMatches(matches);
    setContactsSyncState('done');
  }

  useEffect(() => {
    if (autoSync) handleSyncContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync]);

  async function handleAddFriend(friendId: string) {
    if (!currentUserId || requestStatus[friendId]) return;

    setRequestStatus((current) => ({ ...current, [friendId]: 'sending' }));
    const { error } = await sendFriendRequest(currentUserId, friendId);
    setRequestStatus((current) => ({
      ...current,
      [friendId]: error ? 'idle' : 'sent',
    }));
  }

  const isSearching = query.trim().length > 0;
  const listData: (UserSearchResult | ContactMatch)[] = isSearching ? results : contactMatches;

  let emptyMessage: string | null = null;
  if (isSearching && searched) {
    emptyMessage = 'Aucun ami trouvé';
  } else if (!isSearching && contactsSyncState === 'done' && contactMatches.length === 0) {
    emptyMessage = 'Aucun de tes contacts n’est encore sur RECO';
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={theme.colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Prénom ou @pseudo..."
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <Pressable
        onPress={handleSyncContacts}
        disabled={contactsSyncState === 'syncing'}
        style={({ pressed }) => [styles.syncButton, pressed && styles.pressed]}>
        {contactsSyncState === 'syncing' ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : (
          <>
            <Feather name="users" size={16} color={theme.colors.accent} />
            <Text style={styles.syncButtonText}>Synchroniser mes contacts</Text>
          </>
        )}
      </Pressable>

      {contactsSyncState === 'denied' && (
        <Text style={styles.syncDeniedText}>
          Accès aux contacts refusé — active-le dans Réglages pour retrouver tes amis.
        </Text>
      )}

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={emptyMessage ? <Text style={styles.emptyText}>{emptyMessage}</Text> : null}
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

      <View style={styles.separatorRow}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>ou</Text>
        <View style={styles.separatorLine} />
      </View>

      <Pressable
        onPress={shareInvite}
        style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}>
        <Text style={styles.inviteButtonText}>Inviter des amis</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing.sm,
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
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    height: 44,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  syncButtonText: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  syncDeniedText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
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
  pressed: {
    opacity: 0.85,
  },
});
