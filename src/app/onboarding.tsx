import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { theme } from '@/theme';

type Slide = {
  title: string;
  description: string;
  buttonLabel: string;
};

const slides: Slide[] = [
  {
    title: 'Partage tes meilleures découvertes',
    description:
      'Un endroit unique où tu partages tes films, podcasts, vidéos et livres préférés avec tes potes — sans algo, juste du bouche à oreille.',
    buttonLabel: 'Suivant',
  },
  {
    title: 'Réagis et échange avec tes potes',
    description:
      'Like ❤️ les recos qui t’intéressent, marque 👀 ce que tu as découvert grâce à eux et commente directement sous leurs publications.',
    buttonLabel: 'Suivant',
  },
  {
    title: 'Publie en 2 minutes chrono',
    description:
      'Colle un lien depuis n’importe quelle app, ajoute un commentaire et choisis une catégorie. Ta reco apparaît instantanément dans le feed de tes amis.',
    buttonLabel: 'Commencer',
  },
];

const lastSlideIndex = slides.length - 1;

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Seul cet écran suit le mode sombre/clair du téléphone — le reste de
  // l'app reste volontairement toujours sombre (voir src/theme/index.ts),
  // ce changement est scopé à l'onboarding uniquement, comme demandé.
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const colors = {
    background: isDark ? '#1A1A1A' : '#FFFFFF',
    text: isDark ? '#F5F2EE' : '#1A1A1A',
    muted: theme.colors.muted,
    card: isDark ? theme.colors.card : '#EDEDED',
    dotInactive: isDark ? theme.colors.border : '#DDDDDD',
  };

  function goToCompleteProfile() {
    router.replace('/complete-profile');
  }

  function handlePrimaryPress() {
    if (activeIndex === lastSlideIndex) {
      goToCompleteProfile();
      return;
    }
    const nextIndex = activeIndex + 1;
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    setActiveIndex(nextIndex);
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={styles.sideSlot} />

          <View style={styles.dots}>
            {slides.map((slide, index) => (
              <View
                key={slide.title}
                style={[
                  styles.dot,
                  { backgroundColor: colors.dotInactive },
                  index === activeIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <View style={[styles.sideSlot, styles.sideSlotEnd]}>
            {activeIndex < lastSlideIndex && (
              <Pressable onPress={goToCompleteProfile} hitSlop={12}>
                <Text style={[styles.skipText, { color: colors.muted }]}>Passer</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}>
          {slides.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <View style={styles.slideBody}>
                <View style={[styles.imagePlaceholder, { backgroundColor: colors.card }]}>
                  <Text style={[styles.placeholderText, { color: colors.muted }]}>
                    📸 Capture d’écran à venir
                  </Text>
                </View>

                <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
                <Text style={[styles.description, { color: colors.muted }]}>
                  {slide.description}
                </Text>
              </View>

              <Pressable
                onPress={handlePrimaryPress}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
                <Text style={styles.buttonText}>{slide.buttonLabel}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    height: 44,
  },
  sideSlot: {
    width: 56,
  },
  sideSlotEnd: {
    alignItems: 'flex-end',
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
  },
  dotActive: {
    backgroundColor: theme.colors.accent,
  },
  skipText: {
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.sm,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  slideBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  imagePlaceholder: {
    width: '85%',
    height: 380,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  placeholderText: {
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.md,
    textAlign: 'center',
  },
  title: {
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
    textAlign: 'center',
  },
  description: {
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
    textAlign: 'center',
    lineHeight: theme.fontSizes.md * 1.4,
    paddingHorizontal: theme.spacing.lg,
    maxWidth: 360,
  },
  button: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
});
