import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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
import { deleteReco, getRecoById, type FeedReco } from '@/lib/recos';
import { theme } from '@/theme';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
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
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
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
    scrollViewRef.current?.scrollToEnd({ animated: true });
    commentInputRef.current?.focus();
  }

  const isOwn = reco?.author.id === currentUserId;

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
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
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
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {reco.apercuImage ? (
              <Image source={{ uri: reco.apercuImage }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Feather name="image" size={40} color={theme.colors.muted} />
              </View>
            )}

            <View style={styles.body}>
              {reco.categorie && (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{reco.categorie}</Text>
                </View>
              )}

              <Text style={styles.title}>{reco.titre}</Text>

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
            </View>

            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>Commentaires</Text>

              {comments.length === 0 ? (
                <Text style={styles.emptyText}>Sois le premier à commenter</Text>
              ) : (
                <View style={styles.commentsList}>
                  {comments.map((item) => (
                    <View key={item.id} style={styles.commentRow}>
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
                        <Text style={styles.commentText}>{item.texte}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              value={commentText}
              onChangeText={setCommentText}
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
              numberOfLines={4}
              textAlignVertical="top"
              scrollEnabled={commentInputHeight >= COMMENT_INPUT_MAX_HEIGHT}
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
    gap: theme.spacing.sm,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: theme.withOpacity(theme.colors.accent, 0.2),
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  categoryTagText: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.xs,
  },
  title: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    alignSelf: 'flex-start',
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
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.sm,
  },
  authorName: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  date: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
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
  commentsSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
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
  },
  commentsList: {
    gap: theme.spacing.md,
  },
  commentRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
