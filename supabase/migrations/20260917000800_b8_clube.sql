-- ETAPA B · B8: Clube Carioca Drift (um único clube). Associação é separada de conta, capacidade, piloto autorizado e ingresso.
-- Ser membro NÃO libera pista, NÃO é ingresso e NÃO garante participação: nenhuma função de pista ou bilheteria pode ler esta tabela
-- para autorizar algo (regra de arquitetura; verificada no inventário de dependências a cada etapa).
-- Cobrança, mensalidade, benefícios, renovação e suspensão ficam FORA desta migration: opções para decisão do organizador.
-- Reversão: drop function public.decidir_associacao(uuid,boolean,text), public.encerrar_associacao(uuid,text), public.cancelar_solicitacao_associacao(), public.solicitar_associacao(text), public.eh_membro(uuid); drop table public.associacoes;

create table public.associacoes (
  usuario_id     uuid primary key references public.usuarios (id) on delete cascade,
  status         text not null check (status in ('pendente', 'aprovada', 'recusada', 'cancelada', 'encerrada')),
  mensagem       text check (char_length(mensagem) <= 500),   -- texto do pedido, escrito pelo usuário
  solicitada_em  timestamptz not null default now(),
  decidida_em    timestamptz,
  decidida_por   uuid references public.usuarios (id) on delete set null,
  motivo         text check (char_length(motivo) <= 500),      -- motivo da decisão (admin)
  membro_desde   timestamptz,                                  -- primeira aprovação
  atualizado_em  timestamptz not null default now()
);
comment on table public.associacoes is 'Solicitação e situação de associação ao Clube Carioca Drift. Uma linha por usuário; o histórico fica em acoes_usuario e acoes_admin.';
create index associacoes_status on public.associacoes (status, solicitada_em);
create trigger associacoes_atualizado_em before update on public.associacoes for each row execute function public.toca_atualizado_em();

alter table public.associacoes enable row level security;
create policy "associacoes: dono le a propria" on public.associacoes for select to authenticated using (usuario_id = auth.uid());
create policy "associacoes: admin le" on public.associacoes for select to authenticated using (public.eh_admin());
revoke all on public.associacoes from anon, authenticated;
grant select on public.associacoes to authenticated;   -- toda escrita só por função

-- Membro ativo? (usado pela projeção pública e por áreas do clube; NUNCA por pista ou bilheteria)
create or replace function public.eh_membro(alvo uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.associacoes a where a.usuario_id = alvo and a.status = 'aprovada')
$$;
revoke all on function public.eh_membro(uuid) from public, anon;
grant execute on function public.eh_membro(uuid) to authenticated;

-- Usuário pede associação. Só com cadastro completo. Recusada/cancelada/encerrada pode pedir de novo; pendente ou aprovada, não.
create or replace function public.solicitar_associacao(mensagem_txt text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); atual public.associacoes;
begin
  if uid is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if not exists (select 1 from public.usuarios u where u.id = uid and u.estado_cadastro = 'completo') then
    return jsonb_build_object('ok', false, 'motivo', 'cadastro_incompleto');
  end if;
  select * into atual from public.associacoes where usuario_id = uid;
  if atual.status in ('pendente', 'aprovada') then return jsonb_build_object('ok', false, 'motivo', atual.status); end if;
  insert into public.associacoes (usuario_id, status, mensagem, solicitada_em, decidida_em, decidida_por, motivo)
    values (uid, 'pendente', left(mensagem_txt, 500), now(), null, null, null)
    on conflict (usuario_id) do update set status = 'pendente', mensagem = excluded.mensagem, solicitada_em = now(), decidida_em = null, decidida_por = null, motivo = null;
  insert into public.acoes_usuario (usuario_id, acao, contexto) values (uid, 'associacao_solicitada', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'status', 'pendente');
end $$;

-- Usuário cancela o próprio pedido pendente.
create or replace function public.cancelar_solicitacao_associacao() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  update public.associacoes set status = 'cancelada', decidida_em = now() where usuario_id = uid and status = 'pendente';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_pendente'); end if;
  insert into public.acoes_usuario (usuario_id, acao, contexto) values (uid, 'associacao_cancelada', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'status', 'cancelada');
end $$;

-- Admin aprova ou recusa um pedido pendente. Recusa alvo = chamador. Motivo obrigatório na recusa.
create or replace function public.decidir_associacao(alvo uuid, aprovar boolean, motivo_txt text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.eh_admin() then raise exception 'sem permissão' using errcode = '42501'; end if;
  if alvo = uid then raise exception 'ninguém decide a própria associação' using errcode = '42501'; end if;
  if not aprovar and coalesce(char_length(btrim(motivo_txt)), 0) < 3 then raise exception 'motivo obrigatório na recusa' using errcode = '22023'; end if;
  update public.associacoes
     set status = case when aprovar then 'aprovada' else 'recusada' end,
         decidida_em = now(), decidida_por = uid, motivo = motivo_txt,
         membro_desde = case when aprovar then coalesce(membro_desde, now()) else membro_desde end
   where usuario_id = alvo and status = 'pendente';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_pendente'); end if;
  insert into public.acoes_admin (admin_id, alvo_usuario_id, acao, motivo, contexto)
    values (uid, alvo, case when aprovar then 'associacao_aprovada' else 'associacao_recusada' end, motivo_txt, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'status', case when aprovar then 'aprovada' else 'recusada' end);
end $$;

-- Admin encerra uma associação aprovada (saída, desligamento). Regras de suspensão ficam para decisão posterior.
create or replace function public.encerrar_associacao(alvo uuid, motivo_txt text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.eh_admin() then raise exception 'sem permissão' using errcode = '42501'; end if;
  if alvo = uid then raise exception 'ninguém encerra a própria associação por aqui' using errcode = '42501'; end if;
  if coalesce(char_length(btrim(motivo_txt)), 0) < 3 then raise exception 'motivo obrigatório' using errcode = '22023'; end if;
  update public.associacoes set status = 'encerrada', decidida_em = now(), decidida_por = uid, motivo = motivo_txt where usuario_id = alvo and status = 'aprovada';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_aprovada'); end if;
  insert into public.acoes_admin (admin_id, alvo_usuario_id, acao, motivo, contexto) values (uid, alvo, 'associacao_encerrada', motivo_txt, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'status', 'encerrada');
end $$;

revoke all on function public.solicitar_associacao(text) from public, anon;
revoke all on function public.cancelar_solicitacao_associacao() from public, anon;
revoke all on function public.decidir_associacao(uuid, boolean, text) from public, anon;
revoke all on function public.encerrar_associacao(uuid, text) from public, anon;
grant execute on function public.solicitar_associacao(text), public.cancelar_solicitacao_associacao(), public.decidir_associacao(uuid, boolean, text), public.encerrar_associacao(uuid, text) to authenticated;

-- Identificação de membro no perfil público: só se o perfil estiver público (a projeção continua devolvendo nulo para perfil privado)
create or replace function public.perfil_publico(entrada text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'handle', u.handle,
    'nome_exibicao', u.nome_exibicao,
    'preferencia', u.preferencia,
    'apresentacao', u.apresentacao,
    'instagram', u.instagram,
    'avatar_path', u.avatar_path,
    'membro', exists (select 1 from public.associacoes a where a.usuario_id = u.id and a.status = 'aprovada'),
    'veiculos_publicos', '[]'::jsonb,
    'treinos_aprovados_count', 0
  )
  from public.usuarios u
  where u.handle = public.normalizar_handle(entrada) and u.perfil_publico and u.estado_cadastro = 'completo'
$$;
