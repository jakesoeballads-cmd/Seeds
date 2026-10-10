'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Klien Supabase untuk komponen di browser. Null di mode contoh. */
export function getBrowserClient() {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
