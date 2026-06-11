// =============================================================
//  Login simples do grupo (Supabase Auth — e-mail + senha)
// =============================================================
import { sb } from "./supabase.js";

export async function usuarioAtual() {
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function entrar(email, senha) {
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

export async function cadastrar(email, senha) {
  const { error } = await sb.auth.signUp({ email, password: senha });
  if (error) throw error;
}

export async function sair() {
  await sb.auth.signOut();
}

export function aoMudarLogin(cb) {
  sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
}
