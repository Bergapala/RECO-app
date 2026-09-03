import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AuthResult = { error: string | null };

/**
 * Connecte un utilisateur via Supabase Auth (email + mot de passe).
 * Tant que Supabase n'est pas configuré (voir .env.example), retourne un
 * message d'erreur explicite plutôt que d'échouer silencieusement.
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

/**
 * Crée un compte via Supabase Auth (email + mot de passe).
 *
 * Si la confirmation d'email est activée sur le projet Supabase (Auth >
 * Providers > Email), le compte est créé mais sans session active tant que
 * le lien de confirmation n'a pas été cliqué — `hasActiveSession()` renverra
 * `false` jusque-là même si `signUpWithEmail` n'a pas retourné d'erreur.
 */
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase.auth.signUp({ email, password });
  return { error: error?.message ?? null };
}

/**
 * Envoie un code de vérification par SMS au numéro donné (format E.164,
 * ex. +33612345678) — connexion ou inscription selon que ce numéro a déjà
 * un compte ou non, Supabase gère les deux cas de façon transparente.
 *
 * Nécessite qu'un fournisseur SMS (Twilio, MessageBird, Vonage...) soit
 * configuré sur le projet Supabase (Authentication > Providers > Phone) —
 * sans ça, cet appel renvoie l'erreur de Supabase telle quelle plutôt que
 * de planter, mais aucun SMS ne partira réellement.
 */
export async function sendPhoneOtp(phone: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase.auth.signInWithOtp({ phone });
  return { error: error?.message ?? null };
}

/** Vérifie le code reçu par SMS et ouvre la session si c'est le bon. */
export async function verifyPhoneOtp(phone: string, code: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
  return { error: error?.message ?? null };
}

/**
 * Utilisé au démarrage de l'app (voir src/app/index.tsx) pour savoir si un
 * utilisateur a déjà une session active et doit être envoyé directement vers
 * le feed plutôt que vers l'écran de connexion.
 */
export async function hasActiveSession(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

/**
 * Id de l'utilisateur Supabase actuellement connecté, ou `null` si personne
 * n'est connecté (ou si Supabase n'est pas configuré).
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Déconnecte l'utilisateur (voir src/app/settings.tsx). */
export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

/**
 * Supprime définitivement le compte de l'utilisateur connecté — voir
 * src/app/settings.tsx pour le flux de confirmation en 2 étapes qui précède
 * cet appel.
 *
 * Passe par la Edge Function "delete-user" (supabase/functions/delete-user)
 * plutôt que par un appel direct depuis l'app : supprimer un compte
 * Supabase Auth nécessite la clé service_role, qui ne doit jamais être
 * embarquée côté client. La Edge Function identifie l'utilisateur à partir
 * de son propre jeton de session (jamais d'un id transmis par le client) et
 * appelle `auth.admin.deleteUser()` avec cette clé.
 *
 * Toutes les données applicatives (recos, commentaires, réactions, amis,
 * enregistrements, profil `users`) sont supprimées automatiquement en
 * cascade par Postgres une fois le compte Auth supprimé — `public.users.id`
 * référence `auth.users(id) on delete cascade`, et tout le reste du schéma
 * cascade à partir de `public.users`/`public.recos` (voir les migrations
 * dans supabase/migrations). Aucune suppression manuelle table par table
 * n'est donc nécessaire ici.
 */
export async function deleteAccount(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase.functions.invoke('delete-user', { method: 'POST' });

  if (error) {
    // FunctionsHttpError expose la réponse brute de la Edge Function (voir
    // supabase/functions/delete-user/index.ts) — on essaie d'en extraire le
    // message précis plutôt que le message générique de supabase-js ("Edge
    // Function returned a non-2xx status code").
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // Corps non-JSON ou déjà consommé : on garde le message générique.
      }
    }
    return { error: message };
  }

  // Le compte Auth n'existe plus côté serveur à ce stade — on nettoie aussi
  // la session locale (jetons en Keychain/Keystore) pour repartir sur un
  // état propre plutôt que de laisser une session désormais invalide.
  await supabase.auth.signOut();
  return { error: null };
}
