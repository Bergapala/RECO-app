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

export type SignUpOptions = {
  phone?: string;
  inviteCode?: string;
};

/**
 * Crée un compte via Supabase Auth (email + mot de passe), avec téléphone
 * et code d'invitation optionnels.
 *
 * `phone` et `inviteCode` sont transmis en tant que métadonnées de
 * l'utilisateur Supabase Auth ; le trigger handle_new_user (voir la
 * migration phone_invite_code.sql) les récupère lui-même pour enregistrer
 * le téléphone sur le profil et, si le code correspond à quelqu'un,
 * créer directement une amitié acceptée entre les deux — tout ça côté
 * serveur, de façon atomique avec la création du compte.
 *
 * Si la confirmation d'email est activée sur le projet Supabase (Auth >
 * Providers > Email), le compte est créé mais sans session active tant que
 * le lien de confirmation n'a pas été cliqué — `hasActiveSession()` renverra
 * `false` jusque-là même si `signUpWithEmail` n'a pas retourné d'erreur.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  options?: SignUpOptions,
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase n'est pas encore configuré (voir .env.example)." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: options?.phone || undefined,
        invite_code: options?.inviteCode || undefined,
      },
    },
  });

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
