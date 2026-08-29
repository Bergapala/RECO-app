import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { hasActiveSession } from '@/lib/auth';

const Palette = {
  background: '#1A1A1A',
  accent: '#C0392B',
};

/**
 * Point d'entrée de l'app RECO. Ne rend aucune UI propre : vérifie s'il
 * existe une session Supabase active et redirige immédiatement vers le feed
 * (utilisateur déjà connecté) ou l'écran de connexion (sinon).
 */
export default function EntryGate() {
  const [destination, setDestination] = useState<'/feed' | '/login' | null>(null);

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
      <ActivityIndicator color={Palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
