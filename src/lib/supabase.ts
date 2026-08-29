import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * `true` once EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are set
 * (see .env.example). Tant que Supabase n'est pas connecté, l'app reste
 * utilisable : les appels d'auth échouent proprement au lieu de crasher.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// AsyncStorage's web adapter reaches for `window.localStorage`, which crashes
// during server-side rendering (Expo Router web runs on Node, no `window`).
// On web, leave `storage` unset: supabase-js falls back to its own
// SSR-safe storage (an in-memory stub on the server, `localStorage` in the
// browser). Native platforms keep AsyncStorage so sessions persist to disk.
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

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
