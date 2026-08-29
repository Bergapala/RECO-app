import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

// Routes listed here render on their own, without the tab bar around them —
// currently the RECO auth/onboarding flow, which lives outside the demo tabs.
const routesWithoutTabs = ['index', 'login', 'add-friends', 'feed'];

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [firstSegment] = useSegments();
  const showTabs = !routesWithoutTabs.includes(firstSegment);

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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {showTabs ? <AppTabs /> : <Slot />}
    </ThemeProvider>
  );
}
