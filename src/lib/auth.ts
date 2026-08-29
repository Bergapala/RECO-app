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
