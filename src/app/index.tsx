import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { hasActiveSession } from '@/lib/auth';
import { theme } from '@/theme';

type Destination = '/feed' | '/login';

/**
 * Point d'entrée de l'app RECO. Ne rend aucune UI propre : redirige
 * immédiatement vers le feed (session Supabase active) ou l'écran de
 * connexion (sinon).
 *
 * L'onboarding (3 slides) n'est plus vérifié ici — ce n'est plus une étape
 * de premier lancement, mais une étape affichée juste après l'inscription
 * (voir src/app/login.tsx et src/app/phone-login.tsx), potentiellement
 * plusieurs fois si quelqu'un crée plusieurs comptes — c'est voulu.
 */
export default function EntryGate() {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    let cancelled = false;

    hasActiveSession().then((loggedIn) => {
      if (!cancelled) {
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
