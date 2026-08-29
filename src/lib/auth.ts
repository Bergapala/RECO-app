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
