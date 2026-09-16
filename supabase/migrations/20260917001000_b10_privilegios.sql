-- ETAPA B · B10: revogação geral de privilégios dos papéis da API (anon, authenticated) e concessão explícita,
-- a partir do inventário (supabase/tests/inventario-privilegios.sql, rodado no Postgres isolado e no DEV em 17/09).
-- Antes: o padrão do Supabase dava ALL em toda tabela/sequência/função nova a anon e authenticated, e a RLS era a
-- única barreira (admins, confirmacoes, interessados_escolinha e treinos tinham INSERT/UPDATE/DELETE/TRUNCATE para
-- anon). Depois: cada papel tem só o que uma tela usa; a RLS continua por cima; service_role não muda.
-- Objetos futuros nascem SEM privilégio para anon/authenticated: cada migration concede o que precisa.
-- Reversão: reaplicar os grants padrão (grant all on all tables/sequences/functions in schema public to anon, authenticated
-- e alter default privileges ... grant all ... to anon, authenticated); nenhuma policy muda aqui.

-- 1. padrão para objetos futuros (o papel que roda a migration e qualquer outro com padrão definido no schema)
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;   -- global (por schema não remove o padrão embutido): função nova do papel da migration nasce sem EXECUTE para PUBLIC
do $$ declare r record; begin
  for r in select distinct pg_get_userbyid(defaclrole) as papel from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' loop
    begin
      execute format('alter default privileges for role %I in schema public revoke all on tables from anon, authenticated', r.papel);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated', r.papel);
      execute format('alter default privileges for role %I in schema public revoke all on functions from anon, authenticated', r.papel);
      execute format('alter default privileges for role %I revoke execute on functions from public', r.papel);
    exception when insufficient_privilege then raise notice 'padrão do papel % não alterado (sem permissão)', r.papel; end;
  end loop;
end $$;

-- 2. zera tudo que anon e authenticated têm hoje em public
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- 3. concede exatamente o que cada tela usa (a RLS decide as linhas)
-- painel legado: o admin lê a própria linha em admins (policy); ninguém escreve pela API
grant select on public.admins to authenticated;
-- formulários públicos: visitante só insere (id e criado_em são do banco: colunas identity, sem sequência exposta)
grant insert (evento, nome, telefone) on public.confirmacoes to anon;
grant insert (nome, telefone, mensagem, pacote) on public.interessados_escolinha to anon;
grant insert (evento, nome, telefone, consentimento, origem) on public.interessados_carona to anon, authenticated;
grant usage on sequence public.interessados_carona_id_seq to anon, authenticated;   -- bigserial: precisa de USAGE
-- painel: admin lê e apaga leads (policies exigem eh_admin())
grant select, delete on public.confirmacoes, public.interessados_escolinha, public.interessados_carona to authenticated;
-- treinos: público lê (policy: publicados ou admin); admin cria, edita, apaga (policies)
grant select on public.treinos to anon, authenticated;
grant insert, update, delete on public.treinos to authenticated;
-- contas (B1–B8), inalterado
grant select on public.usuarios to authenticated;
grant update (nome, nome_exibicao, preferencia, apresentacao, instagram, avatar_path, telefone) on public.usuarios to authenticated;
grant select on public.acoes_usuario, public.capacidades, public.acoes_admin, public.associacoes to authenticated;
-- funções: as quatro usadas em policies ou por visitante; o resto só logado; build e registro só service_role
grant execute on function public.eh_admin(), public.avatar_visivel(text), public.handle_disponivel(text), public.perfil_publico(text) to anon, authenticated;
grant execute on function public.origem_admin(), public.definir_handle(text), public.definir_perfil_publico(boolean),
  public.conceder_capacidade(uuid, text, text), public.revogar_capacidade(uuid, text, text), public.eh_membro(uuid),
  public.solicitar_associacao(text), public.cancelar_solicitacao_associacao(), public.decidir_associacao(uuid, boolean, text),
  public.encerrar_associacao(uuid, text) to authenticated;
-- gatilhos (toca_atualizado_em, limita_envios_carona, cria_perfil_usuario) e normalizar_handle: nenhum EXECUTE para a API;
-- gatilho não exige EXECUTE de quem dispara. perfis_publicos_para_build e registra_chamada_build: só service_role (já concedido).
