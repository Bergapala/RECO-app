import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { hasActiveSession } from '@/lib/auth';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { theme } from '@/theme';

type Destination = '/onboarding' | '/feed' | '/login';

/**
 * Point d'entrée de l'app RECO. Ne rend aucune UI propre : redirige
 * immédiatement vers les slides d'onboarding (première ouverture de l'app
 * sur cet appareil), le feed (session Supabase active), ou l'écran de
 * connexion (sinon).
 */
export default function EntryGate() {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([hasSeenOnboarding(), hasActiveSession()]).then(([seenOnboarding, loggedIn]) => {
      if (cancelled) return;

      if (!seenOnboarding) {
        setDestination('/onboarding');
      } else {
        setDestination(loggedIn ? '/feed' : '/login');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (destination) {
    return <Redirect href={destination} />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
