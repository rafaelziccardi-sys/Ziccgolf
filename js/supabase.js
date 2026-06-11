import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";

// Se ainda não configurado, usa valores de placeholder VÁLIDOS só para não
// quebrar o carregamento — a tela de login mostra o aviso para configurar.
const configurado = SUPABASE_URL && !SUPABASE_URL.startsWith("COLE_AQUI");
const url = configurado ? SUPABASE_URL : "https://placeholder.supabase.co";
const key = configurado ? SUPABASE_ANON : "placeholder";

export const sb = createClient(url, key);
