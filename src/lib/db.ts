import { createClient } from '@supabase/supabase-js';

export function db() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,   // server-only
    { auth: { persistSession: false } }
  );
}
