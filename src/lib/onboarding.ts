import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_SEEN_KEY = 'reco:onboarding-seen';

/**
 * Utilisé au démarrage de l'app (voir src/app/index.tsx) pour savoir si les
 * 3 slides d'introduction (src/app/onboarding.tsx) ont déjà été vues sur cet
 * appareil, afin de ne les afficher qu'une seule fois.
 */
export async function hasSeenOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
  return value === 'true';
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}
