import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { getCurrentUserId } from '@/lib/auth';
import { fetchComments, postComment, subscribeToComments, type RecoComment } from '@/lib/comments';
import { getFriendsList, type FriendListItem } from '@/lib/friends';
import { goBack } from '@/lib/navigation';
import { deleteReco, getRecoById, type FeedReco } from '@/lib/recos';
import { theme } from '@/theme';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

/**
 * Découpe le texte d'un commentaire déjà posté pour mettre en évidence les
 * @mentions (voir handleSelectMention) — rendues en colors.accent via des
 * <Text> imbriqués, RN les fusionne visuellement dans le paragraphe.
 */
function renderMentionText(text: string) {
  return text.split(/(@[^\s@]+)/g).map((part, index) =>
    part.startsWith('@') ? (
      <Text key={index} style={{ color: theme.colors.accent }}>
        {part}
      </Text>
    ) : (
      <Text key={index}>{part}</Text>
    ),
  );
}

/**
 * Renvoie le texte tapé après le dernier "@" avant le curseur (ex. "@Lu" ->
 * "Lu"), ou `null` s'il n'y a pas de mention en cours (pas de "@", ou un
 * espace/retour à la ligne déjà tapé après — la mention est alors terminée).
 */
function getMentionQuery(text: string, cursor: number): string | null {
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf('@');
  if (atIndex === -1) return null;

  const afterAt = beforeCursor.slice(atIndex + 1);
  if (/[\s@]/.test(afterAt)) return null;

  return afterAt;
}

// Le champ de commentaire s'agrandit avec le texte tapé, entre 1 et 4
// lignes (au-delà, il scrolle en interne — comportement natif d'un
// TextInput multiline une fois sa hauteur plafonnée).
const COMMENT_INPUT_LINE_HEIGHT = theme.fontSizes.sm * 1.4;
const COMMENT_INPUT_VERTICAL_PADDING = theme.spacing.sm;
const COMMENT_INPUT_MIN_HEIGHT = COMMENT_INPUT_LINE_HEIGHT + COMMENT_INPUT_VERTICAL_PADDING * 2;
const COMMENT_INPUT_MAX_HEIGHT = COMMENT_INPUT_LINE_HEIGHT * 4 + COMMENT_INPUT_VERTICAL_PADDING * 2;

export default function RecoDetailScreen() {
  const router = useRouter();
  const { id, focusComment } = useLocalSearchParams<{ id: string; focusComment?: string }>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recos, setRecos] = useState<FeedReco[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<RecoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentInputHeight, setCommentInputHeight] = useState(COMMENT_INPUT_MIN_HEIGHT);
  const [commentSelection, setCommentSelection] = useState({ start: 0, end: 0 });
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const commentsListRef = useRef<FlatList<RecoComment>>(null);
  const commentInputRef = useRef<TextInput>(null);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);
  const reco = recos[0] ?? null;

  useEffect(() => {
    if (!id) return;

    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      const [found, existingComments] = await Promise.all([
        getRecoById(id, userId),
        fetchComments(id),
      ]);
      setRecos(found ? [found] : []);
      setComments(existingComments);
      setLoading(false);

      // Pour les suggestions @mention (voir plus bas) — la liste d'amis
      // n'a pas besoin d'être rafraîchie en direct, un chargement au
      // montage de l'écran suffit.
      if (userId) setFriends(await getFriendsList(userId));
    });

    const unsubscribe = subscribeToComments(id, (comment) => {
      setComments((current) => [...current, comment]);
    });

    return unsubscribe;
  }, [id]);

  // Venant du bouton 💬 du feed (RecoCard) : focus direct sur le champ de
  // commentaire une fois l'écran prêt. Le petit délai laisse le temps à la
  // transition de navigation et au clavier de s'installer proprement.
  useEffect(() => {
    if (!focusComment || loading) return;
    const timeout = setTimeout(() => commentInputRef.current?.focus(), 300);
    return () => clearTimeout(timeout);
  }, [focusComment, loading]);

  /** Amène le dernier commentaire juste au-dessus du champ de saisie (ou,
   * s'il n'y en a aucun, scrolle simplement pour montrer le champ). */
  function scrollToLastComment(animated: boolean) {
    if (comments.length > 0) {
      commentsListRef.current?.scrollToIndex({
        index: comments.length - 1,
        viewPosition: 1,
        animated,
      });
    } else {
      commentsListRef.current?.scrollToEnd({ animated });
    }
  }

  // Ouverture du clavier (tap sur le champ ou bouton 💬) : keyboardWillShow
  // est plus fluide que keyboardDidShow sur iOS (se déclenche au début de
  // l'animation plutôt qu'à la fin) — le petit délai laisse cette animation
  // démarrer avant de scroller, pour un mouvement synchronisé plutôt que
  // deux à la suite. Se réabonne à chaque changement du nombre de
  // commentaires pour que le callback vise toujours le bon dernier index.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollToLastComment(true), 150);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

  // Un nouveau commentaire arrive (Realtime) pendant que le clavier est
  // déjà ouvert : on scrolle pour le garder visible au-dessus du champ.
  useEffect(() => {
    if (keyboardVisible) scrollToLastComment(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

  async function handleOpenLink() {
    if (!reco?.url) return;
    try {
      await Linking.openURL(reco.url);
    } catch {
      // Rien à faire de plus si le navigateur ne peut pas s'ouvrir.
    }
  }

  async function handleSendComment() {
    if (!currentUserId || !id || commentText.trim().length === 0 || posting) return;

    setPosting(true);
    const { error } = await postComment(id, currentUserId, commentText.trim());
    setPosting(false);

    if (!error) {
      setCommentText('');
      setCommentInputHeight(COMMENT_INPUT_MIN_HEIGHT);
      // Pas besoin d'ajouter localement : l'abonnement Realtime reçoit
      // l'INSERT (y compris les nôtres) et met la liste à jour.
    }
  }

  function handleDelete() {
    Alert.alert('Supprimer cette reco ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: confirmDelete },
    ]);
  }

  async function confirmDelete() {
    if (!id || deleting) return;

    setDeleting(true);
    const { error } = await deleteReco(id);
    setDeleting(false);

    if (!error) {
      router.replace('/feed');
    }
  }

  function handleEdit() {
    if (!id) return;
    router.push({ pathname: '/add-reco', params: { id } });
  }

  function handleFocusCommentInput() {
    // Le scroll est géré par le listener keyboardWillShow/keyboardDidShow
    // ci-dessus dès que ce focus() ouvre effectivement le clavier — pas
    // besoin de le déclencher ici aussi.
    commentInputRef.current?.focus();
  }

  /** Insère "@prénom " à l'emplacement du "@..." en cours de frappe et
   * ferme la liste de suggestions. */
  function handleSelectMention(friend: FriendListItem) {
    const beforeCursor = commentText.slice(0, commentSelection.start);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;

    const insertion = `@${friend.prenom ?? 'ami'} `;
    const newText = commentText.slice(0, atIndex) + insertion + commentText.slice(commentSelection.start);
    const newCursor = atIndex + insertion.length;

    setCommentText(newText);
    setCommentSelection({ start: newCursor, end: newCursor });
  }

  const isOwn = reco?.author.id === currentUserId;

  const mentionQuery = getMentionQuery(commentText, commentSelection.start);
  const mentionSuggestions =
    mentionQuery !== null
      ? friends
          .filter((friend) => (friend.prenom ?? '').toLowerCase().startsWith(mentionQuery.toLowerCase()))
          .slice(0, 5)
      : [];

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.loadingSafeArea}>
          <ActivityIndicator color={theme.colors.accent} />
        </SafeAreaView>
      </View>
    );
  }

  if (!reco) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.loadingSafeArea}>
          <Text style={styles.emptyText}>Cette reco n&rsquo;existe plus.</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.headerButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>

          {isOwn && (
            <View style={styles.headerActions}>
              <Pressable onPress={handleEdit} hitSlop={12} style={styles.headerButton}>
                <Feather name="edit-2" size={20} color={theme.colors.text} />
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={12} style={styles.headerButton}>
                <Feather name="trash-2" size={20} color={theme.colors.error} />
              </Pressable>
            </View>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={12}>
          <FlatList
            ref={commentsListRef}
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            onScrollToIndexFailed={() => {
              // Les hauteurs des lignes varient selon la longueur des
              // commentaires (pas de getItemLayout fiable) — si la mesure
              // n'était pas encore prête, scrollToEnd amène de toute façon
              // au même endroit puisque la cible est le dernier item.
              commentsListRef.current?.scrollToEnd({ animated: true });
            }}
            ListHeaderComponent={
              <>
                {reco.apercuImage ? (
                  <Image source={{ uri: reco.apercuImage }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imagePlaceholder]}>
                    <Feather name="image" size={40} color={theme.colors.muted} />
                  </View>
                )}

                <View style={styles.body}>
                  <Text style={styles.title}>{reco.titre}</Text>

                  <View style={styles.metaRow}>
                    <Pressable
                      onPress={() =>
                        router.push(isOwn ? '/profile' : `/profile/${reco.author.id}`)
                      }
                      hitSlop={8}
                      style={styles.authorRow}>
                      {reco.author.photoUrl ? (
                        <Image source={{ uri: reco.author.photoUrl }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                          <Text style={styles.avatarInitial}>
                            {(reco.author.prenom ?? '?').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.authorName}>{reco.author.prenom ?? 'Sans nom'}</Text>
                      <Text style={styles.date}>{formatDate(reco.createdAt)}</Text>
                    </Pressable>

                    {reco.categorie && (
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>{reco.categorie}</Text>
                      </View>
                    )}
                  </View>

                  {reco.commentaire && <Text style={styles.comment}>{reco.commentaire}</Text>}

                  {reco.url && (
                    <Pressable
                      onPress={handleOpenLink}
                      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
                      <Text style={styles.linkButtonText}>🔗 Ouvrir le lien</Text>
                    </Pressable>
                  )}

                  <View style={styles.actionsBar}>
                    <View style={styles.actionsLeft}>
                      <Pressable
                        onPress={() => reco && onToggleLike(reco)}
                        hitSlop={8}
                        style={styles.actionButton}>
                        <Text style={styles.actionEmoji}>{reco.hasLiked ? '❤️' : '🤍'}</Text>
                        <Text style={styles.actionCount}>{reco.likeCount}</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => reco && onToggleDiscovered(reco)}
                        hitSlop={8}
                        style={styles.actionButton}>
                        <Text style={styles.actionEmoji}>👀</Text>
                        <Text style={styles.actionCount}>{reco.discoveredCount}</Text>
                      </Pressable>

                      <Pressable
                        onPress={handleFocusCommentInput}
                        hitSlop={8}
                        style={styles.actionButton}>
                        <Text style={styles.actionEmoji}>💬</Text>
                        <Text style={styles.actionCount}>{comments.length}</Text>
                      </Pressable>
                    </View>

                    {/* Bookmark : présent pour la V2, pas encore fonctionnel. */}
                    <View style={styles.bookmarkButton}>
                      <Feather name="bookmark" size={20} color={theme.colors.muted} />
                    </View>
                  </View>

                  <View style={styles.separator} />

                  <Text style={styles.commentsTitle}>Commentaires</Text>
                </View>
              </>
            }
            ItemSeparatorComponent={() => <View style={styles.commentSeparator} />}
            ListEmptyComponent={<Text style={styles.emptyText}>Sois le premier à commenter</Text>}
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                {item.author.photoUrl ? (
                  <Image source={{ uri: item.author.photoUrl }} style={styles.commentAvatar} />
                ) : (
                  <View style={[styles.commentAvatar, styles.avatarFallback]}>
                    <Text style={styles.commentAvatarInitial}>
                      {(item.author.prenom ?? '?').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{item.author.prenom ?? 'Sans nom'}</Text>
                    <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{renderMentionText(item.texte)}</Text>
                </View>
              </View>
            )}
          />

          {mentionQuery !== null && mentionSuggestions.length > 0 && (
            <View style={styles.mentionSuggestions}>
              {mentionSuggestions.map((friend) => (
                <Pressable
                  key={friend.id}
                  onPress={() => handleSelectMention(friend)}
                  style={({ pressed }) => [styles.mentionRow, pressed && styles.pressed]}>
                  {friend.photoUrl ? (
                    <Image source={{ uri: friend.photoUrl }} style={styles.mentionAvatar} />
                  ) : (
                    <View style={[styles.mentionAvatar, styles.avatarFallback]}>
                      <Text style={styles.mentionAvatarInitial}>
                        {(friend.prenom ?? '?').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.mentionName}>{friend.prenom ?? 'Sans nom'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              value={commentText}
              onChangeText={setCommentText}
              selection={commentSelection}
              onSelectionChange={(event) => setCommentSelection(event.nativeEvent.selection)}
              onContentSizeChange={(event) => {
                const nextHeight =
                  event.nativeEvent.contentSize.height + COMMENT_INPUT_VERTICAL_PADDING * 2;
                setCommentInputHeight(
                  Math.min(Math.max(nextHeight, COMMENT_INPUT_MIN_HEIGHT), COMMENT_INPUT_MAX_HEIGHT),
                );
              }}
              placeholder="Ajouter un commentaire..."
              placeholderTextColor={theme.colors.muted}
              style={[styles.commentInput, { height: commentInputHeight }]}
              multiline={true}
              textAlignVertical="top"
              // Toujours scrollable, y compris avant d'atteindre la hauteur
              // max : sur iOS, scrollEnabled=false empêche la UITextView de
              // mesurer/afficher le contenu qui dépasse ses bounds actuels
              // (elle ne peut ni scroller ni se redessiner correctement),
              // donc le texte au-delà de la 1ère ligne restait invisible
              // tant que onContentSizeChange n'avait pas (ou jamais) le
              // temps de faire grandir la hauteur. Le plafond à 4 lignes
              // vient uniquement de COMMENT_INPUT_MAX_HEIGHT ci-dessus — pas
              // besoin de désactiver le scroll en dessous.
              scrollEnabled
            />
            <Pressable
              onPress={handleSendComment}
              disabled={commentText.trim().length === 0 || posting}
              style={[
                styles.sendButton,
                (commentText.trim().length === 0 || posting) && styles.sendButtonDisabled,
              ]}>
              <Text style={styles.sendButtonText}>Envoyer</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
  loadingSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  image: {
    width: '100%',
    height: 250,
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
  },
  imagePlaceholder: {
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
  },
  avatarFallback: {
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xs,
  },
  authorName: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  date: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  categoryTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  categoryTagText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.xs,
  },
  comment: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
    lineHeight: theme.fontSizes.md * 1.5,
  },
  linkButton: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  commentsTitle: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.md,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  commentSeparator: {
    height: theme.spacing.md,
  },
  commentRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
  },
  commentAvatarInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xs,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
  },
  commentAuthor: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  commentDate: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  commentText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(28, 28, 28, 0.85)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionsLeft: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  actionEmoji: {
    fontSize: theme.fontSizes.md,
  },
  actionCount: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
  bookmarkButton: {
    padding: theme.spacing.xs,
  },
  mentionSuggestions: {
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing.xs,
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  mentionAvatar: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
  },
  mentionAvatarInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xs,
  },
  mentionName: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.sm,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  commentInput: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: COMMENT_INPUT_VERTICAL_PADDING,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
    lineHeight: COMMENT_INPUT_LINE_HEIGHT,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  sendButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
