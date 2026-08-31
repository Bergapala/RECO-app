import { Share } from 'react-native';

// TODO: remplacer par le vrai lien une fois l'app publiée sur l'App Store
// (voir la préparation du build App Store).
const APP_STORE_URL = 'https://apps.apple.com/app/reco';

/** Ouvre le Share Sheet natif avec le message d'invitation RECO — utilisé
 * depuis l'écran Ajout d'amis (notamment l'état vide "aucun contact
 * trouvé" après synchronisation) et depuis l'état vide du feed. */
export async function shareInvite(): Promise<void> {
  const message = `Salut ! Rejoins-moi sur RECO 🔴 — l'app pour partager tes meilleures découvertes de la semaine avec tes potes. Films, podcasts, vidéos, restos… Télécharge l'app : ${APP_STORE_URL}`;

  try {
    await Share.share({ message });
  } catch {
    // L'utilisateur a simplement annulé le partage — rien à faire.
  }
}
