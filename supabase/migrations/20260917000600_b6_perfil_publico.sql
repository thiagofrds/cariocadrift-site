-- ETAPA B · B6: visibilidade do perfil e projeção pública.
-- Reversão: drop function public.perfis_publicos_para_build(text,int), public.perfil_publico(text), public.definir_perfil_publico(boolean);

-- Liga/desliga o perfil público. Só o dono, só com cadastro completo. Auditado em acoes_usuario.
create or replace function public.definir_perfil_publico(ligar boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); u public.usuarios;
begin
  if uid is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  select * into u from public.usuarios where id = uid;
  if u.id is null then raise exception 'perfil inexistente' using errcode = 'P0002'; end if;
  if u.estado_cadastro <> 'completo' or u.handle is null then return jsonb_build_object('ok', false, 'motivo', 'cadastro_incompleto'); end if;
  if u.perfil_publico = ligar then return jsonb_build_object('ok', true, 'perfil_publico', ligar); end if;
  update public.usuarios set perfil_publico = ligar where id = uid;
  insert into public.acoes_usuario (usuario_id, acao, contexto) values (uid, case when ligar then 'perfil_publicado' else 'perfil_despublicado' end, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'perfil_publico', ligar);
end $$;
revoke all on function public.definir_perfil_publico(boolean) from public, anon;
grant execute on function public.definir_perfil_publico(boolean) to authenticated;

-- A ÚNICA função pública do módulo de contas. Devolve nulo para perfil privado, inexistente ou reservado (sem diferenciar).
-- Projeção fixa; nunca telefone, e-mail, nome completo, datas. Fotos saem só como caminho (a URL assinada é pedida ao storage,
-- cuja policy verifica de novo a visibilidade).
create or replace function public.perfil_publico(entrada text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'handle', u.handle,
    'nome_exibicao', u.nome_exibicao,
    'preferencia', u.preferencia,
    'apresentacao', u.apresentacao,
    'instagram', u.instagram,
    'avatar_path', u.avatar_path,
    'veiculos_publicos', '[]'::jsonb,          -- preenchido na etapa C
    'treinos_aprovados_count', 0               -- preenchido na etapa C
  )
  from public.usuarios u
  where u.handle = public.normalizar_handle(entrada) and u.perfil_publico and u.estado_cadastro = 'completo'
$$;
revoke all on function public.perfil_publico(text) from public;
grant execute on function public.perfil_publico(text) to anon, authenticated;

-- Lista para o build das páginas estáticas /u/<handle>/: só handle e nome de exibição de perfis públicos e completos.
-- EXECUTE só para service_role (chamada pela Edge Function de build com segredo de automação).
create or replace function public.perfis_publicos_para_build(depois text default '', limite int default 500) returns table (handle text, nome_exibicao text)
language sql stable security definer set search_path = '' as $$
  select u.handle, u.nome_exibicao from public.usuarios u
  where u.perfil_publico and u.estado_cadastro = 'completo' and u.handle > coalesce(depois, '')
  order by u.handle limit least(greatest(limite, 1), 1000)
$$;
revoke all on function public.perfis_publicos_para_build(text, int) from public, anon, authenticated;
grant execute on function public.perfis_publicos_para_build(text, int) to service_role;
