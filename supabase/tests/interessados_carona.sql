-- Seis testes da migration interessados_carona, executados com troca de papel e claims como o PostgREST faz.
\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on

-- helpers
create or replace function public._como(papel text, claims jsonb) returns void language plpgsql as $$
begin execute format('set role %I', papel); perform set_config('request.jwt.claims', claims::text, false); end $$;
create or replace function public._reset() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claims', '', false); end $$;
create table public._resultado (n int, teste text, esperado text, obtido text, ok boolean);
create or replace function public._tenta(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return sqlstate || ' ' || sqlerrm; end $$;

-- ===== 1. anon insere válido → ok; anon lê → zero linhas
select _como('anon', '{"role":"anon"}');
insert into _resultado select 1, 'anon insert válido', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Um','21999990001',true)$$), null;
insert into _resultado select 1, 'anon select → sem privilégio (nem lista vazia)', '42501', _tenta($$select count(*) from interessados_carona$$), null;
insert into _resultado select 1, 'anon enviando criado_em antigo → sem privilégio na coluna', '42501', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento,criado_em) values ('open-drift-session','Teste Data','21999990021',true,'2020-01-01')$$), null;
insert into _resultado select 1, 'anon enviando criado_em futuro → sem privilégio na coluna', '42501', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento,criado_em) values ('open-drift-session','Teste Data','21999990022',true,now() + interval '30 days')$$), null;
insert into _resultado select 1, 'anon enviando id escolhido → sem privilégio na coluna', '42501', _tenta($$insert into interessados_carona (id,evento,nome,telefone,consentimento) values (999999,'open-drift-session','Teste Id','21999990023',true)$$), null;
insert into _resultado select 1, 'anon não lê nem escreve tentativas_carona', '42501|42501', (select _tenta($$select count(*) from tentativas_carona$$) || '|' || _tenta($$insert into tentativas_carona (telefone) values ('21900000000')$$)), null;
select _reset();
insert into _resultado select 1, 'nenhuma linha gravada pelas tentativas de manipular id/data', '1', (select count(*)::text from interessados_carona), null;
select _como('anon', '{"role":"anon"}');
select _reset();

insert into treinos (slug,titulo,data,hora_inicio,hora_fim,local_nome,endereco,publicado) values ('treino-rascunho','Rascunho','2026-12-01','09:00','18:00','RJ Race Park','x',false), ('treino-b','B','2026-12-02','09:00','18:00','RJ Race Park','x',true), ('treino-c','C','2026-12-03','09:00','18:00','RJ Race Park','x',true), ('treino-d','D','2026-12-04','09:00','18:00','RJ Race Park','x',true), ('antigo','Antigo','2026-12-05','09:00','18:00','RJ Race Park','x',true), ('lote','Lote','2026-12-06','09:00','18:00','RJ Race Park','x',true);
-- ===== 2. duplicado → 23505; telefone 9 dígitos → 23514 (check); sem consentimento → 23514 (check) ou 42501 (policy)
select _como('anon', '{"role":"anon"}');
insert into _resultado select 2, 'mesmo telefone no mesmo treino → aceito em silêncio (mesma resposta de envio novo)', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Um de novo','21999990001',true)$$), null;
insert into _resultado select 2, 'duplicata não gravou linha nova nem alterou a original', 'Teste Um', (select string_agg(nome, ',') from interessados_carona where telefone = '21999990001'), null;
insert into _resultado select 2, 'evento inexistente → recusado (chave estrangeira / gatilho)', '23503', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-inventado','Teste Ev','21999990009',true)$$), null;
select _reset(); delete from tentativas_carona; select _como('anon', '{"role":"anon"}');
insert into _resultado select 2, 'mesmo telefone, interesse geral (sem treino) → permitido', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values (null,'Teste Um geral','21999990001',true)$$), null;
insert into _resultado select 2, 'mesmo telefone, interesse geral repetido → aceito em silêncio, sem linha nova', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values (null,'Teste Um geral 2','21999990001',true)$$), null;
insert into _resultado select 2, 'lista geral continua com um registro do telefone', '1', (select count(*)::text from interessados_carona where telefone = '21999990001' and evento is null), null;
insert into _resultado select 2, 'evento em rascunho (não publicado) → recusado', '23503', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-rascunho','Teste Rasc','21999990010',true)$$), null;
insert into _resultado select 2, 'telefone com 9 dígitos → check', '23514', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Curto','219999900',true)$$), null;
insert into _resultado select 2, 'telefone com letras → check', '23514', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Letras','21abc990002',true)$$), null;
insert into _resultado select 2, 'nome de 1 caractere → check', '23514', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','X','21999990003',true)$$), null;
insert into _resultado select 2, 'sem consentimento → recusado', '23514|42501', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Sem','21999990004',false)$$), null;
insert into _resultado select 2, 'origem diferente de site → recusado', '23514|42501', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento,origem) values ('open-drift-session','Teste Origem','21999990005',true,'painel')$$), null;
select _reset();

-- ===== 2b. apagar treino com interessado presente também na lista geral → não pode falhar
delete from tentativas_carona;
select _como('anon', '{"role":"anon"}');
insert into _resultado select 2, 'cadastro no treino-b para telefone que já está na lista geral', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-b','Teste Um','21999990001',true)$$), null;
select _reset();
insert into _resultado select 2, 'apagar treino-b (com interessado que também está na lista geral) → sucesso', 'ok', _tenta($$delete from treinos where slug = 'treino-b'$$), null;
insert into _resultado select 2, 'após apagar: nenhum registro perdido; o do treino-b virou geral (3 no total, 2 gerais)', '3 total, 2 gerais', (select count(*)::text from interessados_carona where telefone = '21999990001') || ' total, ' || (select count(*)::text from interessados_carona where telefone = '21999990001' and evento is null) || ' gerais', null;
insert into treinos (slug,titulo,data,hora_inicio,hora_fim,local_nome,endereco,publicado) values ('treino-b','B','2026-12-02','09:00','18:00','RJ Race Park','x',true);
delete from interessados_carona where telefone = '21999990001' and evento is null and nome <> 'Teste Um geral';
-- ===== 3. anon update/delete → sem efeito (sem policy) ou sem privilégio
select _como('anon', '{"role":"anon"}');
insert into _resultado select 3, 'anon update → sem privilégio ou 0 linhas', '42501|0', coalesce(nullif(_tenta($$update interessados_carona set nome = 'hack'$$), 'ok'), '0'), null;
insert into _resultado select 3, 'anon delete → sem privilégio ou 0 linhas', '42501|0', coalesce(nullif(_tenta($$delete from interessados_carona$$), 'ok'), '0'), null;
select _reset();
insert into _resultado select 3, 'registros intactos após tentativas do anon', '2', (select count(*)::text from interessados_carona), null;

-- ===== 4. logado não admin → zero linhas; admin → vê e apaga
select _como('authenticated', '{"role":"authenticated","email":"visitante@exemplo.com","sub":"11111111-1111-1111-1111-111111111111"}');
insert into _resultado select 4, 'logado sem ser admin: select zero linhas', '0', (select count(*)::text from interessados_carona), null;
insert into _resultado select 4, 'logado sem ser admin: delete 0 linhas', 'ok', _tenta($$delete from interessados_carona$$), null;
select _reset();
insert into _resultado select 4, 'registros intactos após não admin', '2', (select count(*)::text from interessados_carona), null;
select _como('authenticated', '{"role":"authenticated","email":"thiagofrds@yahoo.com.br","sub":"22222222-2222-2222-2222-222222222222"}');
insert into _resultado select 4, 'admin: select vê os registros', '2', (select count(*)::text from interessados_carona), null;
insert into _resultado select 4, 'admin: update recusado (sem policy)', '42501|ok-0', (select case when r = 'ok' then 'ok-0' else r end from _tenta($$update interessados_carona set nome = 'editado'$$) r), null;
insert into _resultado select 4, 'admin: nome não mudou', '0', (select count(*)::text from interessados_carona where nome = 'editado'), null;
insert into _resultado select 4, 'admin: apaga o interesse geral', 'ok', _tenta($$delete from interessados_carona where evento is null$$), null;
insert into _resultado select 4, 'admin: restou 1', '1', (select count(*)::text from interessados_carona), null;
select _reset();

-- ===== 5. gatilho anti-abuso: 3 por telefone por hora; 60 por 10 minutos no total
select _como('anon', '{"role":"anon"}');
select _reset();
delete from tentativas_carona;   -- zera as tentativas acumuladas pelos blocos anteriores
-- telefone JÁ cadastrado (21999990001, no open-drift-session): 3 tentativas duplicadas → ok em silêncio; 4ª → P0001
select _como('anon', '{"role":"anon"}');
insert into _resultado select 5, 'telefone cadastrado: 3 tentativas (duplicatas) → ok', 'ok|ok|ok', (select _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','X Y','21999990001',true)$$) || '|' || _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','X Y','21999990001',true)$$) || '|' || _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','X Y','21999990001',true)$$)), null;
insert into _resultado select 5, 'telefone cadastrado: 4ª tentativa → gatilho', 'P0001 limite de envios atingido para este telefone', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','X Y','21999990001',true)$$), null;
-- telefone NOVO: 3 tentativas → ok; 4ª → exatamente a mesma resposta
insert into _resultado select 5, 'telefone novo: 3 tentativas → ok', 'ok|ok|ok', (select _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-b','Novo','21999990031',true)$$) || '|' || _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-c','Novo','21999990031',true)$$) || '|' || _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-d','Novo','21999990031',true)$$)), null;
insert into _resultado select 5, 'telefone novo: 4ª tentativa → mesma resposta do cadastrado', 'P0001 limite de envios atingido para este telefone', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Novo','21999990031',true)$$), null;
select _reset();
delete from tentativas_carona;
-- tentativas antigas (fora da janela) não contam
insert into tentativas_carona (telefone, criado_em) select (21900000000 + g)::text, now() - interval '3 hours' from generate_series(1,40) g;
select _como('anon', '{"role":"anon"}');
insert into _resultado select 5, 'registros antigos não contam para a janela de 10 min', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Janela','21988880001',true)$$), null;
select _reset();
insert into tentativas_carona (telefone) select (21977770000 + g)::text from generate_series(1, 60 - (select count(*) from tentativas_carona where criado_em > now() - interval '10 minutes')::int) g;
insert into _resultado select 5, 'janela de 10 min preenchida com exatamente 60 tentativas', '60', (select count(*)::text from tentativas_carona where criado_em > now() - interval '10 minutes'), null;
select _como('anon', '{"role":"anon"}');
insert into _resultado select 5, 'janela cheia: telefone NOVO → gatilho', 'P0001 limite de envios atingido, tente mais tarde', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Sessenta e um','21966660001',true)$$), null;
insert into _resultado select 5, 'janela cheia: telefone JÁ CADASTRADO → mesma resposta', 'P0001 limite de envios atingido, tente mais tarde', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Sessenta e um','21999990001',true)$$), null;
select _reset();
insert into _resultado select 5, 'tentativas barradas não gravaram registro', '0', (select count(*)::text from interessados_carona where nome = 'Sessenta e um'), null;
insert into _resultado select 5, 'anon não executa a função do gatilho diretamente', '42501', (select _tenta($$select public.limita_envios_carona()$$) from (select _como('anon','{"role":"anon"}')) x), null;
select _reset();

-- ===== 6. isolamento: as outras tabelas continuam como antes
select _como('anon', '{"role":"anon"}');
insert into _resultado select 6, 'anon ainda insere confirmação de presença', 'ok', _tenta($$insert into confirmacoes (evento,nome,telefone) values ('open-drift-session','Teste Presenca','21955550001')$$), null;
insert into _resultado select 6, 'anon ainda insere interesse na escolinha', 'ok', _tenta($$insert into interessados_escolinha (nome,telefone,pacote) values ('Teste Escola','21955550002','nao-sei')$$), null;
insert into _resultado select 6, 'anon não lê confirmações', '0', (select count(*)::text from confirmacoes), null;
insert into _resultado select 6, 'anon lê só treinos publicados (6 publicados, 1 rascunho)', '6', (select count(*)::text from treinos where publicado), null;
select _reset();
insert into _resultado select 6, 'carona não gravou em confirmacoes nem escolinha', '1|1', (select count(*)::text from confirmacoes) || '|' || (select count(*)::text from interessados_escolinha), null;

update _resultado set ok = (obtido = esperado) or (esperado like '%|%' and obtido = any(string_to_array(esperado,'|'))) or (esperado ~ '^[0-9A-Z]{5}$' and obtido like esperado || '%') or (esperado like '%|%' and exists (select 1 from unnest(string_to_array(esperado,'|')) e where obtido like e || '%'));
\pset tuples_only off
\pset format aligned
select n, teste, esperado, left(obtido, 70) as obtido, case when ok then 'PASSOU' else 'FALHOU' end as resultado from _resultado order by n, teste;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from _resultado;
