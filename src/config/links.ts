/**
 * Constantes externes de l'app — URLs et adresse email placeholder,
 * centralisées ici pour être remplacées en un seul endroit une fois les
 * vraies valeurs disponibles (App Store, pages légales, centre d'aide...).
 * Utilisées depuis src/lib/invite.ts et les écrans sous src/app/settings/.
 */

// TODO: remplacer par le vrai lien une fois l'app publiée sur l'App Store.
export const APP_STORE_URL = 'https://apps.apple.com/app/reco';

// Lien d'évaluation — même fiche App Store, avec le paramètre qui ouvre
// directement la boîte de notation plutôt que la page produit.
export const RATE_APP_URL = `${APP_STORE_URL}?action=write-review`;

// TODO: remplacer par la vraie adresse une fois configurée.
export const CONTACT_EMAIL = 'contact@reco.app';

// TODO: remplacer par le vrai lien une fois le centre d'aide en ligne.
export const HELP_CENTER_URL = 'https://reco.app/aide';

// TODO: remplacer par le vrai lien une fois les CGU rédigées.
export const TERMS_URL = 'https://reco.app/conditions';

// TODO: remplacer par le vrai lien une fois la politique rédigée.
export const PRIVACY_POLICY_URL = 'https://reco.app/confidentialite';
