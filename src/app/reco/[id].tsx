import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/context/ThemeContext';
import { useRecoReactions } from '@/hooks/use-reco-reactions';
import { useSavedRecos } from '@/hooks/use-saved-recos';
import { getCurrentUserId } from '@/lib/auth';
import { fetchComments, postComment, subscribeToComments, type RecoComment } from '@/lib/comments';
import { getFriendsList, type FriendListItem } from '@/lib/friends';
import { goBack } from '@/lib/navigation';
import { deleteReco, getRecoById, type FeedReco } from '@/lib/recos';
import { REPORT_REASONS, submitReport, type ReportReason } from '@/lib/reports';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

/**
 * Découpe le texte d'un commentaire déjà posté pour mettre en évidence les
 * @mentions (voir handleSelectMention) — rendues dans la couleur accent via
 * des <Text> imbriqués, RN les fusionne visuellement dans le paragraphe.
 * `accentColor` est transmis par le composant plutôt qu'importé
 * statiquement pour rester cohérent avec le thème actif.
 */
function renderMentionText(text: string, accentColor: string) {
  return text.split(/(@[^\s@]+)/g).map((part, index) =>
    part.startsWith('@') ? (
      <Text key={index} style={{ color: accentColor }}>
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

export default function RecoDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, focusComment } = useLocalSearchParams<{ id: string; focusComment?: string }>();

  // Le champ de commentaire s'agrandit avec le texte tapé, entre 1 et 4
  // lignes (au-delà, il scrolle en interne — comportement natif d'un
  // TextInput multiline une fois sa hauteur plafonnée). fontSizes/spacing
  // sont identiques dans les deux palettes, mais recalculés ici via le
  // thème actif plutôt qu'importés statiquement, par cohérence.
  const COMMENT_INPUT_LINE_HEIGHT = theme.fontSizes.sm * 1.4;
  const COMMENT_INPUT_VERTICAL_PADDING = theme.spacing.sm;
  const COMMENT_INPUT_MIN_HEIGHT = COMMENT_INPUT_LINE_HEIGHT + COMMENT_INPUT_VERTICAL_PADDING * 2;
  const COMMENT_INPUT_MAX_HEIGHT = COMMENT_INPUT_LINE_HEIGHT * 4 + COMMENT_INPUT_VERTICAL_PADDING * 2;
  // Hauteur du header une fois le bouton "..." (44px) pris en compte —
  // sert à positionner le menu contextuel juste en dessous (voir plus bas).
  const HEADER_HEIGHT = 44 + theme.spacing.sm * 2;

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

  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const commentsListRef = useRef<FlatList<RecoComment>>(null);
  const commentInputRef = useRef<TextInput>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { onToggleLike, onToggleDiscovered } = useRecoReactions(setRecos, currentUserId);
  const { onToggleSave } = useSavedRecos(setRecos, currentUserId);
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

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  /** Petit message temporaire (2s, avec un fondu) — utilisé après "Copier
   * le lien" et après l'envoi d'un signalement. */
  function showToast(message: string) {
    setToastMessage(message);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => setToastMessage(null),
      );
    }, 2000);
  }

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

  /** Copie le lien de la reco (menu "..." — voir plus bas) — pas d'appel
   * réseau, juste le presse-papier local, donc pas besoin d'état loading. */
  async function handleCopyLink() {
    setMenuVisible(false);

    if (!reco?.url) {
      showToast('Cette reco n’a pas de lien');
      return;
    }

    await Clipboard.setStringAsync(reco.url);
    showToast('Lien copié !');
  }

  function handleOpenReportModal() {
    setMenuVisible(false);
    setSelectedReason(null);
    setReportDetails('');
    setReportModalVisible(true);
  }

  function handleCloseReportModal() {
    if (submittingReport) return;
    setReportModalVisible(false);
  }

  async function handleSubmitReport() {
    if (!currentUserId || !id || !selectedReason || submittingReport) return;

    setSubmittingReport(true);
    const { error } = await submitReport(currentUserId, id, selectedReason, reportDetails);
    setSubmittingReport(false);

    if (error) {
      Alert.alert('Erreur', error);
      return;
    }

    setReportModalVisible(false);
    showToast('Signalement envoyé, merci 👍');
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
          // Blanc fixe : le fond du cercle reste l'accent rouge quel que
          // soit le mode clair/sombre.
          color: '#FFFFFF',
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
          // Blanc fixe : la pastille garde un fond noir semi-transparent
          // fixe quel que soit le mode clair/sombre.
          color: '#FFFFFF',
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
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quel que soit le mode clair/sombre.
          color: '#FFFFFF',
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
          // Blanc fixe : même raison que avatarInitial ci-dessus.
          color: '#FFFFFF',
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
          // Cette barre garde volontairement un fond sombre fixe (verre
          // teinté, comme la pilule de navigation flottante) quel que soit
          // le mode clair/sombre de l'app.
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
          // Blanc fixe : même raison que avatarInitial ci-dessus.
          color: '#FFFFFF',
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
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quand il est actif (voir sendButtonTextDisabled
          // pour l'état désactivé, sur fond adaptatif).
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.sm,
        },
        sendButtonTextDisabled: {
          color: theme.colors.muted,
        },
        moreButton: {
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        moreMenu: {
          position: 'absolute',
          right: theme.spacing.md,
          minWidth: 190,
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius.md,
          paddingVertical: theme.spacing.xs,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        },
        moreMenuItem: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        moreMenuItemText: {
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
        },
        moreMenuSeparator: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border,
        },
        toast: {
          position: 'absolute',
          left: theme.spacing.lg,
          right: theme.spacing.lg,
          alignItems: 'center',
          // Fond sombre fixe (comme actionsBar / la pilule de navigation) —
          // le toast reste lisible quel que soit le mode clair/sombre.
          backgroundColor: 'rgba(28, 28, 28, 0.92)',
          borderRadius: theme.borderRadius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        toastText: {
          // Blanc fixe : même raison que le fond ci-dessus.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.sm,
          textAlign: 'center',
        },
        reportModalContainer: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        reportModalSafeArea: {
          flex: 1,
        },
        reportModalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        },
        reportModalTitle: {
          flex: 1,
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.lg,
        },
        reportModalContent: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        reasonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.card,
          borderWidth: 1.5,
          borderColor: theme.colors.card,
        },
        reasonRowSelected: {
          borderColor: theme.colors.accent,
        },
        reasonEmoji: {
          fontSize: theme.fontSizes.lg,
        },
        reasonLabel: {
          flex: 1,
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.md,
        },
        reportField: {
          gap: theme.spacing.xs,
          marginTop: theme.spacing.sm,
        },
        reportFieldLabel: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.xs,
        },
        reportDetailsInput: {
          minHeight: 96,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.card,
          padding: theme.spacing.md,
          color: theme.colors.text,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.md,
        },
        reportSubmitButton: {
          height: 52,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: theme.spacing.md,
        },
        reportSubmitButtonDisabled: {
          backgroundColor: theme.colors.border,
        },
        reportSubmitButtonText: {
          // Blanc fixe, pas theme.colors.text : le fond du bouton reste
          // l'accent rouge quel que soit le mode clair/sombre.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
        },
        pressed: {
          opacity: 0.85,
        },
      }),
    [theme, COMMENT_INPUT_LINE_HEIGHT, COMMENT_INPUT_VERTICAL_PADDING],
  );

  const statusBarStyle = theme.mode === 'dark' ? 'light' : 'dark';

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style={statusBarStyle} />
        <SafeAreaView style={styles.loadingSafeArea}>
          <ActivityIndicator color={theme.colors.accent} />
        </SafeAreaView>
      </View>
    );
  }

  if (!reco) {
    return (
      <View style={styles.container}>
        <StatusBar style={statusBarStyle} />
        <SafeAreaView style={styles.loadingSafeArea}>
          <Text style={styles.emptyText}>Cette reco n&rsquo;existe plus.</Text>
        </SafeAreaView>
      </View>
    );
  }

  const isSendDisabled = commentText.trim().length === 0 || posting;

  return (
    <View style={styles.container}>
      <StatusBar style={statusBarStyle} />
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

          {!isOwn && (
            <Pressable onPress={() => setMenuVisible(true)} style={styles.moreButton}>
              <Feather name="more-horizontal" size={22} color={theme.colors.text} />
            </Pressable>
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

                    <Pressable
                      onPress={() => reco && onToggleSave(reco)}
                      hitSlop={8}
                      style={styles.bookmarkButton}>
                      <MaterialIcons
                        name={reco.isSaved ? 'bookmark' : 'bookmark-border'}
                        size={20}
                        color={reco.isSaved ? theme.colors.accent : theme.colors.muted}
                      />
                    </Pressable>
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
                  <Text style={styles.commentText}>
                    {renderMentionText(item.texte, theme.colors.accent)}
                  </Text>
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
              disabled={isSendDisabled}
              style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}>
              <Text style={[styles.sendButtonText, isSendDisabled && styles.sendButtonTextDisabled]}>
                Envoyer
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {menuVisible && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
          <View style={[styles.moreMenu, { top: insets.top + HEADER_HEIGHT + theme.spacing.xs }]}>
            <Pressable
              onPress={handleOpenReportModal}
              style={({ pressed }) => [styles.moreMenuItem, pressed && styles.pressed]}>
              <Text style={styles.moreMenuItemText}>Signaler</Text>
            </Pressable>
            <View style={styles.moreMenuSeparator} />
            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => [styles.moreMenuItem, pressed && styles.pressed]}>
              <Text style={styles.moreMenuItemText}>Copier le lien</Text>
            </Pressable>
          </View>
        </>
      )}

      {toastMessage && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { top: insets.top + HEADER_HEIGHT + theme.spacing.xs, opacity: toastOpacity },
          ]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      <Modal
        visible={reportModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseReportModal}>
        <View style={styles.reportModalContainer}>
          <StatusBar style={statusBarStyle} />
          <SafeAreaView style={styles.reportModalSafeArea}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Pourquoi tu signales cette reco ?</Text>
              <Pressable onPress={handleCloseReportModal} hitSlop={12} style={styles.headerButton}>
                <Feather name="x" size={22} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.reportModalContent}>
              {REPORT_REASONS.map((reason) => {
                const selected = selectedReason === reason.label;
                return (
                  <Pressable
                    key={reason.label}
                    onPress={() => setSelectedReason(reason.label)}
                    style={[styles.reasonRow, selected && styles.reasonRowSelected]}>
                    <Text style={styles.reasonEmoji}>{reason.emoji}</Text>
                    <Text style={styles.reasonLabel}>{reason.label}</Text>
                    {selected && <Feather name="check" size={20} color={theme.colors.accent} />}
                  </Pressable>
                );
              })}

              <View style={styles.reportField}>
                <Text style={styles.reportFieldLabel}>Détails supplémentaires (optionnel)</Text>
                <TextInput
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  placeholder="Ajoute des précisions si besoin..."
                  placeholderTextColor={theme.colors.muted}
                  style={styles.reportDetailsInput}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <Pressable
                onPress={handleSubmitReport}
                disabled={!selectedReason || submittingReport}
                style={[
                  styles.reportSubmitButton,
                  (!selectedReason || submittingReport) && styles.reportSubmitButtonDisabled,
                ]}>
                {submittingReport ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.reportSubmitButtonText}>Envoyer le signalement</Text>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
