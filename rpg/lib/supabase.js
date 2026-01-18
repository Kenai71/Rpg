import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificação de segurança para não quebrar o Build
if (!supabaseUrl || !supabaseKey) {
  // Durante o build do Vercel, isso pode estar vazio.
  // Criamos um cliente "falso" ou nulo apenas para o script não travar.
  console.warn("Aviso: Supabase Keys ausentes. O cliente não funcionará corretamente.");
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;