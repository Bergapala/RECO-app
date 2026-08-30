import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { theme } from '@/theme';

type Slide = {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
};

const slides: Slide[] = [
  {
    icon: '🗣️',
    title: 'Partage tes découvertes',
    description:
      'Un endroit où partager tes meilleures trouvailles avec tes potes — films, podcasts, restos, vidéos…',
    buttonLabel: 'Suivant',
  },
  {
    icon: '🔗',
    title: 'Ajoute une reco en 2 minutes',
    description: 'Colle un lien, écris un commentaire, choisis une catégorie. C’est tout.',
    buttonLabel: 'Suivant',
  },
  {
    icon: '👀',
    title: 'Découvre ce que tes potes aiment',
    description: 'Scroll le feed, réagis aux recos, et laisse-toi surprendre.',
    buttonLabel: 'Commencer',
  },
];

const lastSlideIndex = slides.length - 1;

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={styles.sideSlot} />

          <View style={styles.dots}>
            {slides.map((slide, index) => (
              <View
                key={slide.title}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>

          <View style={[styles.sideSlot, styles.sideSlotEnd]}>
            {activeIndex < lastSlideIndex && (
              <Pressable onPress={goToCompleteProfile} hitSlop={12}>
                <Text style={styles.skipText}>Passer</Text>
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
                <Text style={styles.icon}>{slide.icon}</Text>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
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
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.accent,
  },
  skipText: {
    color: theme.colors.muted,
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
  icon: {
    fontSize: 96,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
    textAlign: 'center',
  },
  description: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
    textAlign: 'center',
    lineHeight: theme.fontSizes.md * 1.4,
    maxWidth: 320,
  },
  button: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
