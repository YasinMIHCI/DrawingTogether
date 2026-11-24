import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

let client: Promise<SupabaseClient> | null = null;

/**
 * Client Supabase unique du site (chargé à la demande) : temps réel, stockage et comptes.
 * La session du compte est gardée dans le navigateur.
 */
export function getSupabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dt.auth' },
      realtime: { params: { eventsPerSecond: 60 } },
    }),
  );
  return client;
}
