-- PROPOSTA (não aplicada): lista de interesse da Carona Radical.
-- Separada de confirmacoes (presença), interessados_escolinha (escolinha), treinos e de qualquer ingresso/inscrição de pista.
-- Aplicar somente com autorização expressa. Reversão: drop table public.interessados_carona cascade; drop function public.limita_envios_carona();

create table public.interessados_carona (
  id            bigserial primary key,
  evento        text references public.treinos(slug) on update cascade on delete set null,  -- treino real de origem; nulo = interesse geral
  nome          text not null check (char_length(btrim(nome)) between 2 and 120),
  telefone      text not null check (telefone ~ '^[0-9]{10,11}$'),
  consentimento boolean not null check (consentimento),  -- aceite explícito de contato pelo telefone informado
  origem        text not null default 'site' check (origem in ('site')),
  criado_em     timestamptz not null default now()
);
comment on table public.interessados_carona is 'Lista de interesse da Carona Radical. Não é reserva, ingresso nem autorização de pista.';

-- um telefone por treino. Nulos são distintos: a lista geral (sem evento) NÃO entra no índice, para que
-- "on delete set null" nunca conflite ao apagar um treino; a duplicidade na lista geral é tratada pelo gatilho.
create unique index interessados_carona_evento_telefone on public.interessados_carona (evento, telefone) where evento is not null;
create index interessados_carona_criado_em on public.interessados_carona (criado_em desc);

alter table public.interessados_carona enable row level security;

-- visitante: só insere, só pelo site, só com consentimento; nunca lê, altera ou apaga
create policy "carona: visitante insere" on public.interessados_carona
  for insert to anon, authenticated
  with check (consentimento and origem = 'site');

-- administradores (verificação no banco via eh_admin(), a mesma das outras tabelas): leem e apagam
create policy "carona: admin le" on public.interessados_carona for select to authenticated using (public.eh_admin());
create policy "carona: admin apaga" on public.interessados_carona for delete to authenticated using (public.eh_admin());
-- sem policy de update: ninguém altera um registro

-- privilégios: revoga o padrão e concede só o necessário
revoke all on public.interessados_carona from anon, authenticated;
grant insert on public.interessados_carona to anon, authenticated;
grant select, delete on public.interessados_carona to authenticated;
grant usage on sequence public.interessados_carona_id_seq to anon, authenticated;

-- validação, duplicidade e proteção contra envios abusivos (além do honeypot no formulário):
-- · evento, quando informado, precisa ser um treino publicado (a chave estrangeira garante que existe);
-- · duplicata (mesmo telefone no mesmo treino, ou na lista geral) é ACEITA EM SILÊNCIO: nada é gravado e a API
--   responde igual a um envio novo (201). Assim ninguém descobre pela API se um telefone já está cadastrado;
-- no máximo 60 registros por 10 minutos no total, e no máximo 3 por telefone por hora.
-- O bloqueio consultivo por transação serializa apenas os inserts desta tabela, por milissegundos, para que a
-- contagem seja exata mesmo com envios simultâneos: nunca barra a menos, nunca barra a mais do que o limite.
create or replace function public.limita_envios_carona() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.evento is not null and not exists (select 1 from public.treinos t where t.slug = new.evento and t.publicado) then
    raise exception 'treino inválido' using errcode = '23503';
  end if;
  perform pg_advisory_xact_lock(hashtext('interessados_carona_limite'));
  if exists (select 1 from public.interessados_carona c where c.telefone = new.telefone and c.evento is not distinct from new.evento) then
    return null;   -- duplicata: ignora sem erro e sem gravar (resposta idêntica à de um envio novo)
  end if;
  if (select count(*) from public.interessados_carona where criado_em > now() - interval '10 minutes') >= 60 then
    raise exception 'limite de envios atingido, tente mais tarde' using errcode = 'P0001';
  end if;
  if (select count(*) from public.interessados_carona where telefone = new.telefone and criado_em > now() - interval '1 hour') >= 3 then
    raise exception 'limite de envios atingido para este telefone' using errcode = 'P0001';
  end if;
  new.nome := btrim(new.nome);
  return new;
end $$;
revoke all on function public.limita_envios_carona() from public, anon, authenticated;
create trigger interessados_carona_limite before insert on public.interessados_carona
  for each row execute function public.limita_envios_carona();

-- TESTES PROPOSTOS (rodar após aplicar, com as chaves de anon e de serviço):
-- 1. anon insert válido com consentimento=true e Prefer: return=minimal → 201 (sem privilégio de leitura); leitura anon → 401/permission denied.
-- 2. mesmo telefone no mesmo treino → 201 sem nova linha (indistinguível de envio novo); evento inexistente → 23503; evento em rascunho → 23503; telefone com 9 dígitos → 400 (check); consentimento=false → 403 (policy).
-- 2b. apagar um treino com interessados (inclusive telefone presente no treino e na lista geral) → sucesso; registros viram interesse geral.
-- 3. anon update/delete → 0 linhas afetadas (sem policy).
-- 4. usuário logado que não é admin → select devolve zero linhas; admin → vê e apaga.
-- 5. 4º envio do mesmo telefone em 1 hora → erro do gatilho; 61º envio em 10 minutos → erro do gatilho; com 40 envios simultâneos e 50 já na janela, exatamente 10 entram e 30 são barrados.
-- 6. painel: aba Leads → Carona Radical lista, filtra por treino, pesquisa por nome/telefone, exporta CSV; registro de teste apagado ao final.
