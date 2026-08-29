import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * `true` once EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are set
 * (see .env.example). Tant que Supabase n'est pas connecté, l'app reste
 * utilisable : les appels d'auth échouent proprement au lieu de crasher.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Stockage sécurisé de la session (access/refresh token) dans le Keychain
// (iOS) / Keystore (Android) via expo-secure-store, plutôt qu'en clair dans
// AsyncStorage.
//
// Limite connue : le Keychain iOS refuse les valeurs de plus de ~2048 octets,
// et une session Supabase (JWT + refresh token) peut dépasser cette taille.
// Si ça devient un problème en pratique, la solution recommandée par
// Supabase est le pattern "LargeSecureStore" (SecureStore ne stocke qu'une
// clé de chiffrement, la session chiffrée va dans AsyncStorage) — je peux le
// mettre en place si besoin, voir
// https://supabase.com/docs/guides/auth/quickstarts/react-native.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// expo-secure-store n'est pas disponible sur web (pas de Keychain/Keystore).
// On y laisse `storage` non défini : supabase-js retombe sur son propre
// stockage sûr pour le SSR (stub en mémoire côté serveur, `localStorage`
// dans le navigateur).
const storage = Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
