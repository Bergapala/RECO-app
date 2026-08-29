/**
 * Thème centralisé de l'app RECO — couleurs, typographie, espacements,
 * rayons de bordure. Toute nouvelle valeur de design (écran, composant)
 * doit venir d'ici plutôt que d'être codée en dur, pour que l'identité
 * visuelle reste cohérente et facile à ajuster en un seul endroit.
 */

export const colors = {
  background: '#1A1A1A', // fond principal
  accent: '#C0392B', // rouge RECO — boutons, logo, éléments clés
  text: '#F5F2EE', // texte principal
  card: '#242424', // fond des cartes / champs
  border: '#333333', // bordures, séparateurs
  muted: '#888888', // texte secondaire
  success: '#27AE60', // vert confirmation
  error: '#E74C3C', // rouge erreur
} as const;

// Les polices sont chargées via @expo-google-fonts (voir src/app/_layout.tsx),
// qui expose chaque graisse sous son propre nom de fontFamily
// (ex. "Syne_800ExtraBold", "Inter_400Regular"). fontTitle/fontBody restent
// les noms de base des familles, à utiliser pour composer ces noms.
export const fontTitle = 'Syne';
export const fontBody = 'Inter';

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const theme = {
  colors,
  fontTitle,
  fontBody,
  fontSizes,
  spacing,
  borderRadius,
} as const;

export type Theme = typeof theme;

export default theme;
