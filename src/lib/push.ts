import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { updatePushToken } from '@/lib/users';

/**
 * Demande la permission de notifications et enregistre le token push Expo
 * de l'appareil dans users.push_token.
 *
 * Ne fait QUE l'enregistrement côté client — voir la migration
 * notifications.sql pour la limite importante : rien n'envoie encore de
 * notification push à partir de ce token (ça nécessite une pièce
 * serveur — Edge Function — non déployée dans ce projet).
 *
 * Deux limites confirmées en testant (pas de la spéculation) :
 * - Expo Go ne supporte plus du tout les notifications push distantes
 *   depuis le SDK 53 ("removed from Expo Go") — il faut un development
 *   build (`expo-dev-client` + EAS Build) pour que ça fonctionne, quelle
 *   que soit la config. Tant que l'app tourne dans Expo Go, cette fonction
 *   échoue silencieusement (warning dans les logs, pas de crash).
 * - Même avec un development build, il faut un projet EAS lié
 *   (`eas init`, jamais fait sur ce projet) pour obtenir un vrai token.
 */
export async function registerForPushNotifications(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return false;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await updatePushToken(userId, tokenResponse.data);
    return true;
  } catch {
    // Le plus souvent : pas de projectId EAS configuré sur ce projet.
    return false;
  }
}
