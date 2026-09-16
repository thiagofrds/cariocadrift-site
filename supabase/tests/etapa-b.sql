-- Testes da etapa B (contas e perfis) no Postgres local isolado, com troca de papel e claims como o PostgREST faz.
\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on

create or replace function public._como(papel text, claims jsonb) returns void language plpgsql as $$
begin execute format('set role %I', papel); perform set_config('request.jwt.claims', claims::text, false); end $$;
create or replace function public._reset() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claims', '', false); end $$;
create table public._resultado (n int, teste text, esperado text, obtido text, ok boolean);
create or replace function public._tenta(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return sqlstate || ' ' || sqlerrm; end $$;
create or replace function public._claims(uid uuid, email text) returns jsonb language sql as $$ select jsonb_build_object('role','authenticated','sub',uid::text,'email',email) $$;

-- contas de teste (o gatilho cria os perfis)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com',  '{"nome":"Ana Souza","preferencia":"piloto","handle":"Ana_Souza","aceite":"true"}'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@exemplo.com','{"nome":"Bruno","preferencia":"espectador","handle":"admin","aceite":"true"}'),          -- reservado → pendente
  ('33333333-3333-3333-3333-333333333333', 'carla@exemplo.com','{"nome":"Carla","preferencia":"piloto","handle":"ana_souza","aceite":"true"}'),          -- colisão → pendente
  ('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br', '{"nome":"Thiago","preferencia":"piloto","handle":"thiago","aceite":"true"}'),   -- admin legado (e-mail em admins)
  ('55555555-5555-5555-5555-555555555555', 'x@exemplo.com', '{}');                                                                                       -- sem metadados

-- ===== 1. gatilho de criação
insert into _resultado select 1, 'perfil criado com handle normalizado', 'ana_souza', (select handle from usuarios where id = '11111111-1111-1111-1111-111111111111'), null;
insert into _resultado select 1, 'handle reservado → conta pendente sem handle', 'handle_pendente|', (select estado_cadastro || '|' || coalesce(handle, '') from usuarios where id = '22222222-2222-2222-2222-222222222222'), null;
insert into _resultado select 1, 'handle em colisão → conta pendente sem handle', 'handle_pendente|', (select estado_cadastro || '|' || coalesce(handle, '') from usuarios where id = '33333333-3333-3333-3333-333333333333'), null;
insert into _resultado select 1, 'sem metadados → perfil com padrões, pendente, nunca deriva do e-mail', 'Nova conta|espectador|handle_pendente|', (select nome || '|' || preferencia || '|' || estado_cadastro || '|' || coalesce(handle, '') from usuarios where id = '55555555-5555-5555-5555-555555555555'), null;
insert into _resultado select 1, 'gatilho idempotente: reinserir a mesma conta não duplica perfil', '1', (select count(*)::text from usuarios where id = '11111111-1111-1111-1111-111111111111'), null;
insert into _resultado select 1, 'perfil nasce privado', 'false', (select perfil_publico::text from usuarios where id = '11111111-1111-1111-1111-111111111111'), null;

-- ===== 2. anônimo não vê nem escreve
select _como('anon', '{"role":"anon"}');
insert into _resultado select 2, 'anon não lê usuarios', '42501', _tenta($$select count(*) from usuarios$$), null;
insert into _resultado select 2, 'anon não lê capacidades', '42501', _tenta($$select count(*) from capacidades$$), null;
insert into _resultado select 2, 'anon não lê handles_reservados', '42501', _tenta($$select count(*) from handles_reservados$$), null;
insert into _resultado select 2, 'anon não insere em usuarios', '42501', _tenta($$insert into usuarios (id,nome,nome_exibicao,preferencia) values (gen_random_uuid(),'X Y','X','piloto')$$), null;
insert into _resultado select 2, 'perfil_publico de perfil privado → nulo', '', coalesce((select perfil_publico('ana_souza'))::text, ''), null;
insert into _resultado select 2, 'perfil_publico de handle inexistente → nulo (mesma resposta)', '', coalesce((select perfil_publico('naoexiste'))::text, ''), null;
insert into _resultado select 2, 'perfil_publico de reservado → nulo (mesma resposta)', '', coalesce((select perfil_publico('admin'))::text, ''), null;
insert into _resultado select 2, 'anon consulta disponibilidade: handle livre', 'true', (select (handle_disponivel('novo_piloto') ->> 'disponivel')), null;
insert into _resultado select 2, 'anon consulta disponibilidade: handle ocupado (com sugestões)', 'false|3', (select (handle_disponivel('ANA_souza') ->> 'disponivel') || '|' || jsonb_array_length(handle_disponivel('ANA_souza') -> 'sugestoes')::text), null;
insert into _resultado select 2, 'anon consulta disponibilidade: reservado → indisponível', 'false', (select (handle_disponivel('ADMIN') ->> 'disponivel')), null;
insert into _resultado select 2, 'anon consulta disponibilidade: inválido', 'false', (select (handle_disponivel('a') ->> 'valido')), null;
insert into _resultado select 2, 'anon não chama definir_handle', '42501', _tenta($$select definir_handle('qualquer')$$), null;
insert into _resultado select 2, 'anon não chama perfis_publicos_para_build', '42501', _tenta($$select * from perfis_publicos_para_build()$$), null;
insert into _resultado select 2, 'anon não chama normalizar_handle', '42501', _tenta($$select normalizar_handle('x')$$), null;
select _reset();

-- ===== 3. dono: leitura, edição por coluna, estado pendente
select _como('authenticated', _claims('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com'));
insert into _resultado select 3, 'dono lê só o próprio perfil', '1', (select count(*)::text from usuarios), null;
insert into _resultado select 3, 'dono edita apresentacao/instagram/telefone', 'ok', _tenta($$update usuarios set apresentacao = 'Piloto de E36', instagram = 'ana.drift', telefone = '21999990001' where id = auth.uid()$$), null;
insert into _resultado select 3, 'dono não altera handle (privilégio de coluna)', '42501', _tenta($$update usuarios set handle = 'outro' where id = auth.uid()$$), null;
insert into _resultado select 3, 'dono não altera perfil_publico direto', '42501', _tenta($$update usuarios set perfil_publico = true where id = auth.uid()$$), null;
insert into _resultado select 3, 'dono não altera estado_cadastro', '42501', _tenta($$update usuarios set estado_cadastro = 'completo' where id = auth.uid()$$), null;
insert into _resultado select 3, 'dono não altera id', '42501', _tenta($$update usuarios set id = gen_random_uuid() where id = auth.uid()$$), null;
insert into _resultado select 3, 'avatar fora da própria pasta → recusado pela policy', '42501', _tenta($$update usuarios set avatar_path = '22222222-2222-2222-2222-222222222222/foto.jpg' where id = auth.uid()$$), null;
insert into _resultado select 3, 'avatar na própria pasta → ok', 'ok', _tenta($$update usuarios set avatar_path = '11111111-1111-1111-1111-111111111111/foto.jpg' where id = auth.uid()$$), null;
insert into _resultado select 3, 'update em perfil de terceiro → 0 linhas', 'ok', _tenta($$update usuarios set apresentacao = 'hack' where id = '33333333-3333-3333-3333-333333333333'$$), null;
insert into _resultado select 3, 'dono não apaga o perfil', '42501', _tenta($$delete from usuarios where id = auth.uid()$$), null;
insert into _resultado select 3, 'definir_handle com handle já definido → ja_definido', 'ja_definido', (select definir_handle('ana2') ->> 'motivo'), null;
select _reset();
insert into _resultado select 3, 'terceiro não foi alterado', '', coalesce((select apresentacao from usuarios where id = '33333333-3333-3333-3333-333333333333'), ''), null;

-- conta pendente (Carla): só definir_handle
select _como('authenticated', _claims('33333333-3333-3333-3333-333333333333', 'carla@exemplo.com'));
insert into _resultado select 3, 'pendente: update de qualquer coluna → 0 linhas (policy exige completo)', 'ok|Carla', _tenta($$update usuarios set nome_exibicao = 'Mudou' where id = auth.uid()$$) || '|' || (select nome_exibicao from usuarios where id = auth.uid()), null;
insert into _resultado select 3, 'pendente: ligar perfil público → cadastro_incompleto', 'cadastro_incompleto', (select definir_perfil_publico(true) ->> 'motivo'), null;
insert into _resultado select 3, 'pendente: definir_handle reservado → reservado', 'reservado', (select definir_handle('suporte') ->> 'motivo'), null;
insert into _resultado select 3, 'pendente: definir_handle ocupado → indisponivel', 'indisponivel', (select definir_handle('ana_souza') ->> 'motivo'), null;
insert into _resultado select 3, 'pendente: definir_handle inválido → invalido', 'invalido', (select definir_handle('a b') ->> 'motivo'), null;
insert into _resultado select 3, 'pendente: definir_handle válido → ok', 'true', (select definir_handle('Carla RJ') ->> 'ok'), null;
insert into _resultado select 3, 'pendente: após definir → handle gravado e cadastro completo', 'carlarj|completo', (select handle || '|' || estado_cadastro from usuarios where id = auth.uid()), null;
insert into _resultado select 3, 'histórico do usuário registra handle_definido', '1', (select count(*)::text from acoes_usuario where usuario_id = auth.uid() and acao = 'handle_definido'), null;
insert into _resultado select 3, 'definir_handle de novo → ja_definido', 'ja_definido', (select definir_handle('outro') ->> 'motivo'), null;
select _reset();

-- ===== 4. visibilidade e projeção pública
select _como('authenticated', _claims('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com'));
insert into _resultado select 4, 'dono liga perfil público', 'true', (select definir_perfil_publico(true) ->> 'perfil_publico'), null;
select _reset();
select _como('anon', '{"role":"anon"}');
insert into _resultado select 4, 'perfil público visível por anon com a projeção fixa', 'ana_souza|Ana|piloto|ana.drift', (select (perfil_publico('ana_souza') ->> 'handle') || '|' || (perfil_publico('ana_souza') ->> 'nome_exibicao') || '|' || (perfil_publico('ana_souza') ->> 'preferencia') || '|' || (perfil_publico('ana_souza') ->> 'instagram')), null;
insert into _resultado select 4, 'projeção nunca traz telefone, e-mail, nome completo ou datas', 'sem-dados', (select case when p ? 'telefone' or p ? 'email' or p ? 'nome' or p ? 'criado_em' or p::text like '%21999990001%' or p::text like '%ana@%' then 'vazou' else 'sem-dados' end from perfil_publico('ana_souza') p), null;
insert into _resultado select 4, 'perfil_publico aceita variação de caixa/acento (normaliza)', 'ana_souza', (select perfil_publico('Ana_Souza') ->> 'handle'), null;
select _reset();
select _como('authenticated', _claims('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com'));
insert into _resultado select 4, 'dono desliga perfil público', 'false', (select definir_perfil_publico(false) ->> 'perfil_publico'), null;
insert into _resultado select 4, 'histórico registra publicado e despublicado', '2', (select count(*)::text from acoes_usuario where usuario_id = auth.uid() and acao in ('perfil_publicado','perfil_despublicado')), null;
select _reset();
select _como('anon', '{"role":"anon"}');
insert into _resultado select 4, 'após desligar: perfil_publico → nulo imediatamente', '', coalesce((select perfil_publico('ana_souza'))::text, ''), null;
select _reset();
update usuarios set perfil_publico = true where id = '11111111-1111-1111-1111-111111111111';   -- deixa público para os testes de storage/build
select _como('service_role', '{"role":"service_role"}');
insert into _resultado select 4, 'service_role: lista para o build só com públicos e completos', 'ana_souza:Ana', (select string_agg(handle || ':' || nome_exibicao, ',') from perfis_publicos_para_build()), null;
select _reset();

-- ===== 5. capacidades, modo duplo e revogação
-- Thiago: admin legado (e-mail em admins), sem linha em capacidades
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 5, 'admin legado (só e-mail) continua admin no modo duplo', 'true|legado', (select eh_admin()::text || '|' || origem_admin()), null;
insert into _resultado select 5, 'admin lê todos os perfis', '5', (select count(*)::text from usuarios), null;
insert into _resultado select 5, 'admin não concede capacidade a si mesmo', '42501', _tenta($$select conceder_capacidade('44444444-4444-4444-4444-444444444444','admin','auto')$$), null;
insert into _resultado select 5, 'admin concede admin a Ana', 'ok', _tenta($$select conceder_capacidade('11111111-1111-1111-1111-111111111111','admin','migração de teste')$$), null;
insert into _resultado select 5, 'admin concede fotografo a Carla', 'ok', _tenta($$select conceder_capacidade('33333333-3333-3333-3333-333333333333','fotografo','portfólio aprovado')$$), null;
insert into _resultado select 5, 'capacidade inválida → recusada', '22023', _tenta($$select conceder_capacidade('33333333-3333-3333-3333-333333333333','deus','x')$$), null;
insert into _resultado select 5, 'auditoria registrou as concessões', '2', (select count(*)::text from acoes_admin where acao like 'concede_%'), null;
select _reset();
select _como('authenticated', _claims('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com'));
insert into _resultado select 5, 'Ana: admin via capacidades', 'true|capacidades', (select eh_admin()::text || '|' || origem_admin()), null;
insert into _resultado select 5, 'Ana lê as próprias capacidades e as de todos (é admin)', '2', (select count(*)::text from capacidades), null;
insert into _resultado select 5, 'ninguém insere direto em capacidades', '42501', _tenta($$insert into capacidades (usuario_id, capacidade) values (auth.uid(), 'fotografo')$$), null;
insert into _resultado select 5, 'ninguém altera direto capacidades', '42501', _tenta($$update capacidades set revogada_em = null$$), null;
insert into _resultado select 5, 'Ana não revoga a própria capacidade', '42501', _tenta($$select revogar_capacidade('11111111-1111-1111-1111-111111111111','admin','x')$$), null;
select _reset();
-- Carla (fotógrafa, não admin)
select _como('authenticated', _claims('33333333-3333-3333-3333-333333333333', 'carla@exemplo.com'));
insert into _resultado select 5, 'fotógrafa não é admin', 'false|nenhuma', (select eh_admin()::text || '|' || origem_admin()), null;
insert into _resultado select 5, 'fotógrafa lê só a própria capacidade', '1|fotografo', (select count(*)::text || '|' || min(capacidade) from capacidades), null;
insert into _resultado select 5, 'não admin não concede capacidade', '42501', _tenta($$select conceder_capacidade('22222222-2222-2222-2222-222222222222','admin','x')$$), null;
insert into _resultado select 5, 'não admin não lê acoes_admin', '0', (select count(*)::text from acoes_admin), null;
select _reset();
-- semear Thiago em capacidades (como o script de migração faria) e depois revogar Ana
insert into capacidades (usuario_id, capacidade, motivo) values ('44444444-4444-4444-4444-444444444444', 'admin', 'migração');
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 5, 'admin migrado: origem passa a ser capacidades', 'true|capacidades', (select eh_admin()::text || '|' || origem_admin()), null;
insert into _resultado select 5, 'revogar admin de Ana', 'ok', _tenta($$select revogar_capacidade('11111111-1111-1111-1111-111111111111','admin','teste de revogação')$$), null;
insert into _resultado select 5, 'revogar de novo → não estava ativa', 'P0002', _tenta($$select revogar_capacidade('11111111-1111-1111-1111-111111111111','admin','x')$$), null;
select _reset();
select _como('authenticated', _claims('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com'));
insert into _resultado select 5, 'Ana revogada: eh_admin falso na hora, origem revogado', 'false|revogado', (select eh_admin()::text || '|' || origem_admin()), null;
insert into _resultado select 5, 'Ana revogada: volta a ler só o próprio perfil', '1', (select count(*)::text from usuarios), null;
select _reset();
-- defesa em profundidade: reinserir o e-mail da revogada na tabela legada não reabilita
insert into admins (email) values ('ana@exemplo.com');
select _como('authenticated', _claims('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com'));
insert into _resultado select 5, 'e-mail legado reinserido após revogação: continua falso (capacidades tem precedência)', 'false', (select eh_admin()::text), null;
select _reset();
delete from admins where email = 'ana@exemplo.com';
-- revogar admin migrado remove o e-mail legado na mesma transação (rollback do modo duplo não reabilita)
insert into admins (email) values ('bruno@exemplo.com');
insert into capacidades (usuario_id, capacidade, motivo) values ('22222222-2222-2222-2222-222222222222', 'admin', 'migração');
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 5, 'revogar Bruno (migrado)', 'ok', _tenta($$select revogar_capacidade('22222222-2222-2222-2222-222222222222','admin','saiu da organização')$$), null;
select _reset();
insert into _resultado select 5, 'e-mail de Bruno removido de admins na mesma transação', '0', (select count(*)::text from admins where email = 'bruno@exemplo.com'), null;
insert into _resultado select 5, 'auditoria da revogação guarda o e-mail legado removido', 'bruno@exemplo.com', (select contexto ->> 'email_legado_removido' from acoes_admin where acao = 'revoga_admin' and alvo_usuario_id = '22222222-2222-2222-2222-222222222222'), null;
-- rollback simulado: corpo antigo de eh_admin() → Bruno continua fora, Thiago continua dentro
create or replace function public.eh_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email')); $$;
select _como('authenticated', _claims('22222222-2222-2222-2222-222222222222', 'bruno@exemplo.com'));
insert into _resultado select 5, 'rollback para eh_admin antigo: revogado continua falso', 'false', (select eh_admin()::text), null;
select _reset();
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 5, 'rollback para eh_admin antigo: admin nunca revogado continua verdadeiro', 'true', (select eh_admin()::text), null;
select _reset();
-- restaura o modo duplo
create or replace function public.eh_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.capacidades c where c.usuario_id = auth.uid() and c.capacidade = 'admin')
    then exists (select 1 from public.capacidades c where c.usuario_id = auth.uid() and c.capacidade = 'admin' and c.revogada_em is null)
    else exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email')) end $$;
grant execute on function public.eh_admin() to anon, authenticated;

-- ===== 6. painel atual continua funcionando (regressão)
select _como('anon', '{"role":"anon"}');
insert into _resultado select 6, 'anon lê treinos publicados', '1', (select count(*)::text from treinos where publicado), null;
insert into _resultado select 6, 'anon insere confirmação de presença', 'ok', _tenta($$insert into confirmacoes (evento,nome,telefone) values ('open-drift-session','Teste','21955550001')$$), null;
insert into _resultado select 6, 'anon insere interesse na escolinha', 'ok', _tenta($$insert into interessados_escolinha (nome,telefone,pacote) values ('Teste','21955550002','nao-sei')$$), null;
insert into _resultado select 6, 'anon insere interesse em carona', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste','21955550003',true)$$), null;
insert into _resultado select 6, 'anon não lê confirmações (após B10: sem privilégio)', '42501', _tenta($$select count(*) from confirmacoes$$), null;
select _reset();
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 6, 'admin lê confirmações, escolinha e carona', '1|1|1', (select (select count(*) from confirmacoes)::text || '|' || (select count(*) from interessados_escolinha)::text || '|' || (select count(*) from interessados_carona)::text), null;
insert into _resultado select 6, 'admin cria treino em rascunho', 'ok', _tenta($$insert into treinos (slug,titulo,data,hora_inicio,hora_fim,local_nome,endereco,publicado) values ('teste-b','Teste B','2026-12-20','09:00','18:00','RJ','x',false)$$), null;
insert into _resultado select 6, 'admin publica e apaga treino', 'ok|ok', _tenta($$update treinos set publicado = true where slug = 'teste-b'$$) || '|' || _tenta($$delete from treinos where slug = 'teste-b'$$), null;
select _reset();
select _como('authenticated', _claims('33333333-3333-3333-3333-333333333333', 'carla@exemplo.com'));
insert into _resultado select 6, 'logado não admin não escreve em treinos', 'ok|0', _tenta($$update treinos set titulo = 'hack'$$) || '|' || (select count(*)::text from treinos where titulo = 'hack'), null;
select _reset();

-- ===== 7. storage de avatares (stub local com as mesmas policies)
insert into storage.objects (bucket_id, name, owner) values ('avatares', '11111111-1111-1111-1111-111111111111/foto.jpg', '11111111-1111-1111-1111-111111111111'), ('avatares', '33333333-3333-3333-3333-333333333333/foto.jpg', '33333333-3333-3333-3333-333333333333');
grant select, insert, update, delete on storage.objects to anon, authenticated;   -- no Supabase real esse grant já existe
select _como('anon', '{"role":"anon"}');
insert into _resultado select 7, 'anon vê só o avatar de perfil público (Ana pública, Carla privada)', '1', (select count(*)::text from storage.objects where bucket_id = 'avatares'), null;
select _reset();
select _como('authenticated', _claims('33333333-3333-3333-3333-333333333333', 'carla@exemplo.com'));
insert into _resultado select 7, 'Carla vê o próprio avatar e o da Ana (pública), não outros', '2', (select count(*)::text from storage.objects where bucket_id = 'avatares'), null;
insert into _resultado select 7, 'Carla envia só na própria pasta', 'ok|42501', _tenta($$insert into storage.objects (bucket_id,name,owner) values ('avatares','33333333-3333-3333-3333-333333333333/nova.jpg',auth.uid())$$) || '|' || left(_tenta($$insert into storage.objects (bucket_id,name,owner) values ('avatares','11111111-1111-1111-1111-111111111111/hack.jpg',auth.uid())$$), 5), null;
insert into _resultado select 7, 'Carla tenta apagar avatar alheio → sem erro e sem efeito', 'ok', _tenta($$delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/foto.jpg'$$), null;
select _reset();
insert into _resultado select 7, 'avatar alheio continua lá', '1', (select count(*)::text from storage.objects where name = '11111111-1111-1111-1111-111111111111/foto.jpg'), null;
update usuarios set perfil_publico = false where id = '11111111-1111-1111-1111-111111111111';
select _como('anon', '{"role":"anon"}');
insert into _resultado select 7, 'Ana despublicada: anon não vê mais o avatar', '0', (select count(*)::text from storage.objects where bucket_id = 'avatares'), null;
select _reset();


-- ===== 9. Clube Carioca Drift: solicitação, decisão, status, identificação de membro
select _como('anon', '{"role":"anon"}');
insert into _resultado select 9, 'anon não lê associacoes', '42501', _tenta($$select count(*) from associacoes$$), null;
insert into _resultado select 9, 'anon não solicita associação', '42501', _tenta($$select solicitar_associacao('oi')$$), null;
select _reset();
-- conta pendente (x@exemplo.com) não pode solicitar
select _como('authenticated', _claims('55555555-5555-5555-5555-555555555555', 'x@exemplo.com'));
insert into _resultado select 9, 'cadastro incompleto não solicita associação', 'cadastro_incompleto', (select solicitar_associacao('quero') ->> 'motivo'), null;
select _reset();
-- Carla (completa) solicita
select _como('authenticated', _claims('33333333-3333-3333-3333-333333333333', 'carla@exemplo.com'));
insert into _resultado select 9, 'Carla solicita associação → pendente', 'pendente', (select solicitar_associacao('Ando desde 2023, quero fazer parte.') ->> 'status'), null;
insert into _resultado select 9, 'solicitar de novo com pendente → recusado (pendente)', 'pendente', (select solicitar_associacao('de novo') ->> 'motivo'), null;
insert into _resultado select 9, 'Carla acompanha o próprio status', 'pendente', (select status from associacoes where usuario_id = auth.uid()), null;
insert into _resultado select 9, 'Carla não vê associações de outros', '1', (select count(*)::text from associacoes), null;
insert into _resultado select 9, 'ninguém altera associacoes direto', '42501', _tenta($$update associacoes set status = 'aprovada'$$), null;
insert into _resultado select 9, 'ninguém insere em associacoes direto', '42501', _tenta($$insert into associacoes (usuario_id, status) values (auth.uid(), 'aprovada')$$), null;
insert into _resultado select 9, 'não admin não decide associação', '42501', _tenta($$select decidir_associacao('33333333-3333-3333-3333-333333333333', true, null)$$), null;
insert into _resultado select 9, 'eh_membro(Carla) antes da decisão → falso', 'false', (select eh_membro()::text), null;
insert into _resultado select 9, 'Carla cancela o pedido', 'cancelada', (select cancelar_solicitacao_associacao() ->> 'status'), null;
insert into _resultado select 9, 'cancelar sem pendente → nao_pendente', 'nao_pendente', (select cancelar_solicitacao_associacao() ->> 'motivo'), null;
insert into _resultado select 9, 'após cancelar, pode solicitar de novo', 'pendente', (select solicitar_associacao('Segunda tentativa.') ->> 'status'), null;
select _reset();
-- Thiago (admin) decide
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 9, 'admin vê as solicitações', '1', (select count(*)::text from associacoes where status = 'pendente'), null;
insert into _resultado select 9, 'admin não decide a própria associação', '42501', _tenta($$select decidir_associacao('44444444-4444-4444-4444-444444444444', true, null)$$), null;
insert into _resultado select 9, 'recusa sem motivo → recusada pela função', '22023', _tenta($$select decidir_associacao('33333333-3333-3333-3333-333333333333', false, '')$$), null;
insert into _resultado select 9, 'admin aprova Carla', 'aprovada', (select decidir_associacao('33333333-3333-3333-3333-333333333333', true, null) ->> 'status'), null;
insert into _resultado select 9, 'decidir de novo → nao_pendente', 'nao_pendente', (select decidir_associacao('33333333-3333-3333-3333-333333333333', true, null) ->> 'motivo'), null;
insert into _resultado select 9, 'histórico administrativo registra a aprovação', '1', (select count(*)::text from acoes_admin where acao = 'associacao_aprovada' and alvo_usuario_id = '33333333-3333-3333-3333-333333333333'), null;
select _reset();
insert into _resultado select 9, 'membro_desde preenchido na primeira aprovação', 'true', (select (membro_desde is not null)::text from associacoes where usuario_id = '33333333-3333-3333-3333-333333333333'), null;
-- identificação de membro no perfil público (só com perfil público)
select _como('authenticated', _claims('33333333-3333-3333-3333-333333333333', 'carla@exemplo.com'));
insert into _resultado select 9, 'Carla é membro', 'true', (select eh_membro()::text), null;
insert into _resultado select 9, 'Carla liga perfil público', 'true', (select definir_perfil_publico(true) ->> 'perfil_publico'), null;
select _reset();
select _como('anon', '{"role":"anon"}');
insert into _resultado select 9, 'perfil público mostra membro = true', 'true', (select perfil_publico('carlarj') ->> 'membro'), null;
insert into _resultado select 9, 'anon não chama eh_membro', '42501', _tenta($$select eh_membro('33333333-3333-3333-3333-333333333333')$$), null;
select _reset();
-- encerramento e separação de conceitos
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 9, 'encerrar sem motivo → recusado', '22023', _tenta($$select encerrar_associacao('33333333-3333-3333-3333-333333333333', '')$$), null;
insert into _resultado select 9, 'admin encerra a associação de Carla', 'encerrada', (select encerrar_associacao('33333333-3333-3333-3333-333333333333', 'pediu desligamento') ->> 'status'), null;
select _reset();
select _como('anon', '{"role":"anon"}');
insert into _resultado select 9, 'perfil público volta a mostrar membro = false', 'false', (select perfil_publico('carlarj') ->> 'membro'), null;
select _reset();
insert into _resultado select 9, 'separação: nenhuma função de pista/bilheteria/carona referencia associacoes', '0', (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('limita_envios_carona','eh_admin','conceder_capacidade','revogar_capacidade') and pg_get_functiondef(p.oid) ilike '%associacoes%'), null;
insert into _resultado select 9, 'membro não vira admin nem fotógrafo', '0', (select count(*)::text from capacidades where usuario_id = '33333333-3333-3333-3333-333333333333' and capacidade = 'admin'), null;
update usuarios set perfil_publico = false where id = '33333333-3333-3333-3333-333333333333';

-- ===== 8. inventário de privilégios: só perfil_publico e handle_disponivel (e eh_admin, usada em policies) para anon
insert into _resultado select 8, 'funções novas executáveis por anon (esperado: eh_admin, handle_disponivel, perfil_publico)', 'avatar_visivel,eh_admin,handle_disponivel,perfil_publico',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname not like '\_%' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname in ('eh_admin','origem_admin','handle_disponivel','definir_handle','normalizar_handle','definir_perfil_publico','perfil_publico','perfis_publicos_para_build','conceder_capacidade','revogar_capacidade','cria_perfil_usuario','limita_envios_carona','avatar_visivel','eh_membro','solicitar_associacao','cancelar_solicitacao_associacao','decidir_associacao','encerrar_associacao')), null;
insert into _resultado select 8, 'colunas de usuarios editáveis por authenticated (exatamente as 7 da seção 3.1)', 'apresentacao,avatar_path,instagram,nome,nome_exibicao,preferencia,telefone',
  (select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges where table_schema = 'public' and table_name = 'usuarios' and grantee = 'authenticated' and privilege_type = 'UPDATE'), null;
insert into _resultado select 8, 'anon sem nenhum privilégio em usuarios/capacidades/acoes', '0',
  (select count(*)::text from information_schema.table_privileges where table_schema = 'public' and grantee = 'anon' and table_name in ('usuarios','capacidades','acoes_usuario','acoes_admin','handles_reservados','tentativas_handle')), null;

-- objetos criados após B10, para provar o padrão
select _reset();
set role dono;
create table public._nova (id int);
create function public._nova_fn() returns int language sql as $$ select 1 $$;
reset role;

-- ===== 10. B10: privilégios exatos dos papéis da API (inventário) e regressão dos formulários/painel
select _reset();
insert into _resultado select 10, 'anon: privilégios de tabela inteira (só treinos SELECT)', 'treinos:SELECT',
  (select coalesce(string_agg(table_name || ':' || privilege_type, ',' order by table_name, privilege_type), '') from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon' and table_name not like '\_%'), null;
insert into _resultado select 10, 'anon: privilégios por coluna (só INSERT nos 3 formulários)', 'confirmacoes:INSERT:evento,nome,telefone|interessados_carona:INSERT:consentimento,evento,nome,origem,telefone|interessados_escolinha:INSERT:mensagem,nome,pacote,telefone',
  (select string_agg(x, '|' order by x) from (select c.table_name || ':' || c.privilege_type || ':' || string_agg(c.column_name, ',' order by c.column_name) as x from information_schema.role_column_grants c where c.table_schema = 'public' and c.grantee = 'anon' and not exists (select 1 from information_schema.role_table_grants t where t.table_schema = 'public' and t.table_name = c.table_name and t.grantee = 'anon' and t.privilege_type = c.privilege_type) group by c.table_name, c.privilege_type) q), null;
insert into _resultado select 10, 'authenticated: privilégios de tabela inteira', 'acoes_admin:SELECT,acoes_usuario:SELECT,admins:SELECT,associacoes:SELECT,capacidades:SELECT,confirmacoes:DELETE,confirmacoes:SELECT,interessados_carona:DELETE,interessados_carona:SELECT,interessados_escolinha:DELETE,interessados_escolinha:SELECT,treinos:DELETE,treinos:INSERT,treinos:SELECT,treinos:UPDATE,usuarios:SELECT',
  (select string_agg(table_name || ':' || privilege_type, ',' order by table_name, privilege_type) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name not like '\_%'), null;
insert into _resultado select 10, 'PUBLIC sem privilégio em nenhuma tabela/função de public', '0',
  (select ((select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'PUBLIC') + (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like '\_%' and has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')))::text), null;
insert into _resultado select 10, 'funções executáveis por anon (exatamente 4)', 'avatar_visivel,eh_admin,handle_disponivel,perfil_publico',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like '\_%' and has_function_privilege('anon', p.oid, 'execute')), null;
insert into _resultado select 10, 'funções executáveis por authenticated (14)', 'avatar_visivel,cancelar_solicitacao_associacao,conceder_capacidade,decidir_associacao,definir_handle,definir_perfil_publico,eh_admin,eh_membro,encerrar_associacao,handle_disponivel,origem_admin,perfil_publico,revogar_capacidade,solicitar_associacao',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like '\_%' and has_function_privilege('authenticated', p.oid, 'execute')), null;
insert into _resultado select 10, 'service_role executa build e registro de chamada', 'true|true', (has_function_privilege('service_role', 'public.perfis_publicos_para_build(text,int)', 'execute')::text || '|' || has_function_privilege('service_role', 'public.registra_chamada_build(text)', 'execute')::text), null;
insert into _resultado select 10, 'sequências: anon/authenticated só na de carona', 'interessados_carona_id_seq',
  (select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'S' and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('authenticated', c.oid, 'usage'))), null;
insert into _resultado select 10, 'privilégios padrão de public sem anon/authenticated (papel dono; harness é só do teste)', '0',
  (select count(*)::text from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace, unnest(d.defaclacl) a where n.nspname = 'public' and pg_get_userbyid(d.defaclrole) <> 'harness' and a::text ~ '^(anon|authenticated)='), null;
insert into _resultado select 10, 'objeto novo nasce sem privilégio para a API', '0|0', (select (select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='_nova' and grantee in ('anon','authenticated'))::text || '|' || (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='_nova_fn' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')))::text from (select 1) x), null;
-- regressão funcional após a revogação
select _como('anon', '{"role":"anon"}');
insert into _resultado select 10, 'anon insere confirmação (coluna identity sem USAGE na sequência)', 'ok', _tenta($$insert into confirmacoes (evento,nome,telefone) values ('open-drift-session','Teste B10','21955550101')$$), null;
insert into _resultado select 10, 'anon insere escolinha', 'ok', _tenta($$insert into interessados_escolinha (nome,telefone,pacote) values ('Teste B10','21955550102','nao-sei')$$), null;
insert into _resultado select 10, 'anon insere carona', 'ok', _tenta($$insert into interessados_carona (evento,nome,telefone,consentimento) values ('open-drift-session','Teste B10','21955550103',true)$$), null;
insert into _resultado select 10, 'anon não informa id nem criado_em na confirmação', '42501', _tenta($$insert into confirmacoes (evento,nome,telefone,criado_em) values ('open-drift-session','Teste','21955550104',now())$$), null;
insert into _resultado select 10, 'anon lê treinos publicados', '1', (select count(*)::text from treinos where publicado), null;
insert into _resultado select 10, 'anon não escreve em treinos (privilégio, não só RLS)', '42501', _tenta($$update treinos set titulo = 'x'$$), null;
insert into _resultado select 10, 'anon não lê admins', '42501', _tenta($$select count(*) from admins$$), null;
insert into _resultado select 10, 'anon não lê escolinha', '42501', _tenta($$select count(*) from interessados_escolinha$$), null;
insert into _resultado select 10, 'anon não executa função de build', '42501', _tenta($$select perfis_publicos_para_build('', 10)$$), null;
insert into _resultado select 10, 'anon não executa função do clube', '42501', _tenta($$select eh_membro('11111111-1111-1111-1111-111111111111')$$), null;
select _reset();
select _como('authenticated', _claims('44444444-4444-4444-4444-444444444444', 'thiagofrds@yahoo.com.br'));
insert into _resultado select 10, 'admin: login legado (admins), lê leads e apaga', 'true|1|ok', (select eh_admin()::text) || '|' || (select count(*) from confirmacoes where nome = 'Teste B10')::text || '|' || _tenta($$delete from confirmacoes where nome = 'Teste B10'$$), null;
insert into _resultado select 10, 'admin: cria treino', 'ok', _tenta($$insert into treinos (slug,titulo,data) values ('teste-b10','Teste B10','2026-10-10')$$), null;
insert into _resultado select 10, 'admin: edita treino (gatilho atualizado_em sem EXECUTE para a API)', 'ok', _tenta($$update treinos set titulo = 'Teste B10 editado' where slug = 'teste-b10'$$), null;
insert into _resultado select 10, 'admin: gatilho atualizou atualizado_em', 'true', (select (atualizado_em > criado_em)::text from treinos where slug = 'teste-b10'), null;
insert into _resultado select 10, 'admin: apaga treino', 'ok', _tenta($$delete from treinos where slug = 'teste-b10'$$), null;
insert into _resultado select 10, 'admin: aprova/encerra continuam executáveis', 'true|true', has_function_privilege('public.decidir_associacao(uuid,boolean,text)', 'execute')::text || '|' || has_function_privilege('public.conceder_capacidade(uuid,text,text)', 'execute')::text, null;
select _reset();
select _como('authenticated', _claims('11111111-1111-1111-1111-111111111111', 'ana@exemplo.com'));
insert into _resultado select 10, 'logado comum: não vê leads (RLS), não apaga treino (0 linhas), edita o próprio perfil', '0|ok|ok', (select count(*)::text from confirmacoes) || '|' || _tenta($$delete from treinos where slug = 'open-drift-session'$$) || '|' || _tenta($$update usuarios set apresentacao = 'B10' where id = auth.uid()$$), null;
insert into _resultado select 10, 'logado comum: treino continua lá', '1', (select count(*)::text from treinos where slug = 'open-drift-session'), null;
select _reset();

update _resultado set ok = (obtido = esperado) or (esperado ~ '^[0-9A-Z]{5}$' and obtido like esperado || '%');
\pset tuples_only off
\pset format aligned
select n, teste, esperado, left(obtido, 70) as obtido, case when ok then 'PASSOU' else 'FALHOU' end as resultado from _resultado order by n, teste;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from _resultado;
