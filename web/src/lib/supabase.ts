import { createClient } from '@supabase/supabase-js';

// Sin login: solo la clave publicable (anon). Lo que se puede hacer lo limitan RLS y las
// funciones de la base.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Mensaje en español que devuelve la base (las reglas lo arman), o uno genérico. */
export function mensajeDeError(error: { message?: string } | null): string {
  return error?.message || 'No se pudo completar la operación. Intente de nuevo.';
}
