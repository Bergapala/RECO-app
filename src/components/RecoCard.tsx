import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedReco } from '@/lib/recos';
import { theme } from '@/theme';

const IMAGE_HEIGHT = 200;

type RecoCardProps = {
  reco: FeedReco;
  onToggleLike: (reco: FeedReco) => void;
  onToggleDiscovered: (reco: FeedReco) => void;
};

export function RecoCard({ reco, onToggleLike, onToggleDiscovered }: RecoCardProps) {
  const router = useRouter();
  const authorInitial = (reco.author.prenom ?? '?').trim().charAt(0).toUpperCase();

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

        {reco.categorie && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{reco.categorie}</Text>
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

        <Pressable
          onPress={() => router.push(`/profile/${reco.author.id}`)}
          hitSlop={8}
          style={styles.authorRow}>
          {reco.author.photoUrl ? (
            <Image source={{ uri: reco.author.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{authorInitial}</Text>
            </View>
          )}
          <Text style={styles.authorName}>{reco.author.prenom ?? 'Sans nom'}</Text>
        </Pressable>

        <View style={styles.reactionsRow}>
          <Pressable
            onPress={() => onToggleLike(reco)}
            hitSlop={8}
            style={styles.reactionButton}>
            <Text style={styles.reactionEmoji}>{reco.hasLiked ? '❤️' : '🤍'}</Text>
            <Text style={styles.reactionCount}>{reco.likeCount}</Text>
          </Pressable>

          <Pressable
            onPress={() => onToggleDiscovered(reco)}
            hitSlop={8}
            style={styles.reactionButton}>
            <Text style={styles.reactionEmoji}>👀</Text>
            <Text style={styles.reactionCount}>{reco.discoveredCount}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  categoryTag: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
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
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
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
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.sm,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xs,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  reactionEmoji: {
    fontSize: theme.fontSizes.md,
  },
  reactionCount: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
  },
});
