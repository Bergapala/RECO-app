import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemeProvider as AppThemeProvider } from '@/context/ThemeContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Keep the native splash screen up until the fonts RECO's UI depends on
  // (Syne for titles, Inter for body text) are ready, to avoid a flash of
  // fallback system fonts.
  if (!fontsLoaded) {
    return null;
  }

  return (
    // Swipeable (utilisé sur l'écran Mes amis pour "swipe pour retirer")
    // a besoin de ce wrapper racine pour fonctionner correctement,
    // notamment sur Android.
    <GestureHandlerRootView style={styles.flexFill}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppThemeProvider>
          <AnimatedSplashOverlay />
          <Slot />
        </AppThemeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
});
