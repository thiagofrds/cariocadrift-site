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
select _reset();

-- ===== 2. duplicado → 23505; telefone 9 dígitos → 23514 (check); sem consentimento → 23514 (check) ou 42501 (policy)
select _como('anon', '{"role":"anon"}');
insert into _resultado select 2, 'mesmo telefone no mesmo treino → unicidade', '23505', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Um de novo','21999990001',true)$$), null;
insert into _resultado select 2, 'mesmo telefone, interesse geral (sem treino) → permitido', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values (null,'Teste Um geral','21999990001',true)$$), null;
insert into _resultado select 2, 'mesmo telefone, interesse geral repetido → unicidade', '23505', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values (null,'Teste Um geral 2','21999990001',true)$$), null;
insert into _resultado select 2, 'telefone com 9 dígitos → check', '23514', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Curto','219999900',true)$$), null;
insert into _resultado select 2, 'telefone com letras → check', '23514', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Letras','21abc990002',true)$$), null;
insert into _resultado select 2, 'nome de 1 caractere → check', '23514', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','X','21999990003',true)$$), null;
insert into _resultado select 2, 'sem consentimento → recusado', '23514|42501', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste Sem','21999990004',false)$$), null;
insert into _resultado select 2, 'origem diferente de site → recusado', '23514|42501', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento,origem) values ('open-drift-session','Teste Origem','21999990005',true,'painel')$$), null;
select _reset();

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

-- ===== 5. gatilho anti-abuso: 3 por telefone por hora; 30 por 10 minutos no total
select _como('anon', '{"role":"anon"}');
insert into _resultado select 5, '2º e 3º envio do mesmo telefone em treinos diferentes → ok', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-b','Teste Um','21999990001',true),('treino-c','Teste Um','21999990001',true)$$), null;
insert into _resultado select 5, '4º envio do mesmo telefone em 1 hora → gatilho', 'P0001', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-d','Teste Um','21999990001',true)$$), null;
select _reset();
-- 27 registros antigos (fora da janela) não contam; 27 novos + 3 já feitos = 30 → o 31º cai
insert into interessados_carona (evento,nome,telefone,consentimento,criado_em) select 'antigo', 'Antigo', (21900000000 + g)::text, true, now() - interval '2 hours' from generate_series(1,40) g;
select _como('anon', '{"role":"anon"}');
insert into _resultado select 5, 'registros antigos não contam para a janela de 10 min', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Janela','21988880001',true)$$), null;
select _reset();
insert into interessados_carona (evento,nome,telefone,consentimento) select 'lote', 'Lote', (21977770000 + g)::text, true from generate_series(1, 30 - (select count(*) from interessados_carona where criado_em > now() - interval '10 minutes')::int) g;
insert into _resultado select 5, 'janela de 10 min preenchida com exatamente 30', '30', (select count(*)::text from interessados_carona where criado_em > now() - interval '10 minutes'), null;
select _como('anon', '{"role":"anon"}');
insert into _resultado select 5, 'total na janela = 30: 31º envio → gatilho', 'P0001', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Trinta e um','21966660001',true)$$), null;
select _reset();
insert into _resultado select 5, 'anon não executa a função do gatilho diretamente', '42501', (select _tenta($$select public.limita_envios_carona()$$) from (select _como('anon','{"role":"anon"}')) x), null;
select _reset();

-- ===== 6. isolamento: as outras tabelas continuam como antes
select _como('anon', '{"role":"anon"}');
insert into _resultado select 6, 'anon ainda insere confirmação de presença', 'ok', _tenta($$insert into confirmacoes (evento,nome,telefone) values ('open-drift-session','Teste Presenca','21955550001')$$), null;
insert into _resultado select 6, 'anon ainda insere interesse na escolinha', 'ok', _tenta($$insert into interessados_escolinha (nome,telefone,pacote) values ('Teste Escola','21955550002','nao-sei')$$), null;
insert into _resultado select 6, 'anon não lê confirmações', '0', (select count(*)::text from confirmacoes), null;
insert into _resultado select 6, 'anon lê treinos publicados', '1', (select count(*)::text from treinos where publicado), null;
select _reset();
insert into _resultado select 6, 'carona não gravou em confirmacoes nem escolinha', '1|1', (select count(*)::text from confirmacoes) || '|' || (select count(*)::text from interessados_escolinha), null;

update _resultado set ok = (obtido = esperado) or (esperado like '%|%' and obtido = any(string_to_array(esperado,'|'))) or (esperado ~ '^[0-9A-Z]{5}$' and obtido like esperado || '%') or (esperado like '%|%' and exists (select 1 from unnest(string_to_array(esperado,'|')) e where obtido like e || '%'));
\pset tuples_only off
\pset format aligned
select n, teste, esperado, left(obtido, 60) as obtido, case when ok then 'PASSOU' else 'FALHOU' end as resultado from _resultado order by n, teste;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from _resultado;
