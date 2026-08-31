import type { ImperativeRouter } from 'expo-router';

/**
 * Comme router.back(), mais se replie sur le feed si l'écran a été atteint
 * sans historique de navigation (lien profond, notification, ou
 * rechargement de l'app en dev) — sans ça, router.back() ne fait alors
 * silencieusement rien et la flèche retour semble cassée. Utilisé par
 * toutes les flèches retour de l'app pour un comportement cohérent.
 */
export function goBack(router: ImperativeRouter): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/feed');
  }
}
