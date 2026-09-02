import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/context/ThemeContext';

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
  const theme = useTheme();
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
        imagePlaceholder: {
          width: '85%',
          height: 380,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.sm,
        },
        placeholderText: {
          color: theme.colors.muted,
          fontFamily: `${theme.fontBody}_500Medium`,
          fontSize: theme.fontSizes.md,
          textAlign: 'center',
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
          // Toujours blanc, jamais theme.colors.text : le fond du bouton
          // reste l'accent rouge fixe quel que soit le mode clair/sombre,
          // le texte doit donc rester lisible dessus dans les deux cas.
          color: '#FFFFFF',
          fontFamily: `${theme.fontBody}_600SemiBold`,
          fontSize: theme.fontSizes.md,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
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
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.placeholderText}>📸 Capture d’écran à venir</Text>
                </View>

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
