import { createClient } from '@supabase/supabase-js';

// Verificação segura: Se não tiver chave (no build do Vercel), retorna null em vez de travar o site.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;