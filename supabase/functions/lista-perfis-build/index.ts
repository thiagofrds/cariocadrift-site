// Edge Function `lista-perfis-build` (plano da etapa B, seção 4.2).
// Única peça que usa a chave de serviço, e ela fica nos segredos do Supabase. Devolve só handle e nome de exibição
// dos perfis públicos e completos, para o build gerar /u/<handle>/. Exige o cabeçalho x-build-token igual ao segredo
// BUILD_TOKEN (comparação em tempo constante); sem ele responde 401 sem corpo. Limite de 60 chamadas por hora,
// contado no banco (registra_chamada_build). Sem verificação de JWT: o token de build é a autenticação.
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("BUILD_TOKEN") ?? "";
const enc = new TextEncoder();
function igual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length === 0 || x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response(null, { status: 405 });
  if (!igual(req.headers.get("x-build-token") ?? "", TOKEN)) return new Response(null, { status: 401 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: permitido, error: e1 } = await sb.rpc("registra_chamada_build", { origem_txt: req.headers.get("user-agent") ?? "" });
  if (e1) return new Response(null, { status: 500 });
  if (!permitido) return new Response(null, { status: 429 });
  const depois = new URL(req.url).searchParams.get("depois") ?? "";
  const { data, error } = await sb.rpc("perfis_publicos_para_build", { depois, limite: 500 });
  if (error) return new Response(null, { status: 500 });
  return new Response(JSON.stringify(data ?? []), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
});
