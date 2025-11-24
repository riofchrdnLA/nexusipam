import { createClient } from '@supabase/supabase-js';

// Helper to safely get env vars without crashing if objects are undefined
const getEnvVar = (key: string): string => {
  try {
    // Check import.meta.env (Vite)
    // Cast to any to avoid TS7053 error since ImportMetaEnv doesn't have index signature by default
    if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as any)[key]) {
      return (import.meta.env as any)[key];
    }
  } catch (e) {
    // Ignore errors
  }

  try {
    // Check process.env (Node/Compat)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // Ignore errors
  }

  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Create client only if configured, otherwise create a dummy client to prevent errors before usage
// The dummy client allows the app to load, while isSupabaseConfigured flag prevents actual network calls in storage.ts
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder'
);