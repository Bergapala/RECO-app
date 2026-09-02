import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import type { FeedReco } from '@/lib/recos';

const IMAGE_HEIGHT = 200;

// Ombre légère commune à tous les éléments posés sur l'image (avatar,
// pastille catégorie) pour qu'ils restent lisibles quelle que soit la
// couleur de l'image en dessous.
const overlayShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.5,
  shadowRadius: 3,
  elevation: 3,
};

const overlayTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

type RecoCardProps = {
  reco: FeedReco;
  onToggleLike: (reco: FeedReco) => void;
  onToggleDiscovered: (reco: FeedReco) => void;
  onToggleSave: (reco: FeedReco) => void;
  /** Pour rediriger vers "mon profil" plutôt que /profile/[id] quand on
   * clique sur son propre nom (ex. dans la liste de son propre profil). */
  currentUserId?: string | null;
};

export function RecoCard({
  reco,
  onToggleLike,
  onToggleDiscovered,
  onToggleSave,
  currentUserId,
}: RecoCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const authorInitial = (reco.author.prenom ?? '?').trim().charAt(0).toUpperCase();
  const isOwnReco = reco.author.id === currentUserId;

  function goToAuthor() {
    router.push(isOwnReco ? '/profile' : `/profile/${reco.author.id}`);
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius.md,
          marginHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.md,
          overflow: 'hidden',
        },
        cardPressed: {
          opacity: 0.9,
        },
        imageContainer: {
          height: IMAGE_HEIGHT,
        },
        image: {
          width: '100%',
          height: IMAGE_HEIGHT,
        },
        imagePlaceholder: {
          backgroundColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        authorOverlay: {
          position: 'absolute',
          top: theme.spacing.sm,
          left: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
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
          // Blanc fixe, pas theme.colors.text : ce nom est posé sur la
          // photo de la reco (couleur arbitraire), pas sur le fond de
          // l'app — il doit rester lisible dans les deux modes, avec
          // l'ombre portée (overlayTextShadow) comme filet de sécurité.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.sm,
        },
        categoryTag: {
          position: 'absolute',
          top: theme.spacing.sm,
          right: theme.spacing.sm,
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
        body: {
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        },
        title: {
          color: theme.colors.text,
          fontFamily: `${theme.fontTitle}_700Bold`,
          fontSize: theme.fontSizes.md,
        },
        comment: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_400Regular`,
          fontSize: theme.fontSizes.sm,
          lineHeight: theme.fontSizes.sm * 1.4,
        },
        actionsBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
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
      }),
    [theme],
  );

  return (
    <Pressable
      onPress={() => router.push(`/reco/${reco.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.imageContainer}>
        {reco.apercuImage ? (
          <Image source={{ uri: reco.apercuImage }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Feather name="image" size={32} color={theme.colors.muted} />
          </View>
        )}

        <Pressable onPress={goToAuthor} hitSlop={8} style={styles.authorOverlay}>
          {reco.author.photoUrl ? (
            <Image source={{ uri: reco.author.photoUrl }} style={[styles.avatar, overlayShadow]} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, overlayShadow]}>
              <Text style={styles.avatarInitial}>{authorInitial}</Text>
            </View>
          )}
          <Text style={[styles.authorName, overlayTextShadow]}>
            {reco.author.prenom ?? 'Sans nom'}
          </Text>
        </Pressable>

        {reco.categorie && (
          <View style={[styles.categoryTag, overlayShadow]}>
            <Text style={[styles.categoryTagText, overlayTextShadow]}>{reco.categorie}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{reco.titre}</Text>

        {reco.commentaire && (
          <Text style={styles.comment} numberOfLines={2}>
            {reco.commentaire}
          </Text>
        )}
      </View>

      <View style={styles.actionsBar}>
        <View style={styles.actionsLeft}>
          <Pressable
            onPress={() => onToggleLike(reco)}
            hitSlop={8}
            style={styles.actionButton}>
            <Text style={styles.actionEmoji}>{reco.hasLiked ? '❤️' : '🤍'}</Text>
            <Text style={styles.actionCount}>{reco.likeCount}</Text>
          </Pressable>

          <Pressable
            onPress={() => onToggleDiscovered(reco)}
            hitSlop={8}
            style={styles.actionButton}>
            <Text style={styles.actionEmoji}>👀</Text>
            <Text style={styles.actionCount}>{reco.discoveredCount}</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({ pathname: '/reco/[id]', params: { id: reco.id, focusComment: '1' } })
            }
            hitSlop={8}
            style={styles.actionButton}>
            <Text style={styles.actionEmoji}>💬</Text>
            <Text style={styles.actionCount}>{reco.commentCount}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => onToggleSave(reco)} hitSlop={8} style={styles.bookmarkButton}>
          <MaterialIcons
            name={reco.isSaved ? 'bookmark' : 'bookmark-border'}
            size={20}
            color={reco.isSaved ? theme.colors.accent : theme.colors.muted}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}
