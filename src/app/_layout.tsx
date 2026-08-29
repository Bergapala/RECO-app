import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

// Routes listed here render on their own, without the tab bar around them.
const routesWithoutTabs = ['login'];

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [firstSegment] = useSegments();
  const showTabs = !routesWithoutTabs.includes(firstSegment);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {showTabs ? <AppTabs /> : <Slot />}
    </ThemeProvider>
  );
}
