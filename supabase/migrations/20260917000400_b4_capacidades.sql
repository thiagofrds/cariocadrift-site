-- ETAPA B · B4: capacidades (admin, fotografo), auditoria administrativa e funções de conceder/revogar.
-- A tabela admins (e-mail) continua intacta; a migração para capacidades é feita em B5/B6 e pelo script de semente.
-- Reversão: drop function public.revogar_capacidade(uuid,text,text), public.conceder_capacidade(uuid,text,text); drop table public.acoes_admin, public.capacidades;

create table public.capacidades (
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  capacidade    text not null check (capacidade in ('admin', 'fotografo')),
  concedida_por uuid references public.usuarios (id) on delete set null,
  concedida_em  timestamptz not null default now(),
  revogada_em   timestamptz,
  motivo        text check (char_length(motivo) <= 500),
  primary key (usuario_id, capacidade)      -- revogação preserva a linha (histórico); nova concessão reativa
);
alter table public.capacidades enable row level security;
create policy "capacidades: dono le as proprias" on public.capacidades for select to authenticated using (usuario_id = auth.uid());
create policy "capacidades: admin le" on public.capacidades for select to authenticated using (public.eh_admin());
revoke all on public.capacidades from anon, authenticated;
grant select on public.capacidades to authenticated;   -- nenhuma escrita pela API: só as funções abaixo

create table public.acoes_admin (
  id               bigserial primary key,
  admin_id         uuid references public.usuarios (id) on delete set null,
  alvo_usuario_id  uuid references public.usuarios (id) on delete set null,
  acao             text not null,
  motivo           text check (char_length(motivo) <= 500),
  contexto         jsonb not null default '{}'::jsonb,
  criado_em        timestamptz not null default now()
);
create index acoes_admin_criado_em on public.acoes_admin (criado_em desc);
alter table public.acoes_admin enable row level security;
create policy "acoes_admin: admin le" on public.acoes_admin for select to authenticated using (public.eh_admin());
revoke all on public.acoes_admin from anon, authenticated;
grant select on public.acoes_admin to authenticated;

-- Concede uma capacidade a outro usuário. Recusa alvo = chamador. Exige admin (verificado no banco).
create or replace function public.conceder_capacidade(alvo uuid, cap text, motivo_txt text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.eh_admin() then raise exception 'sem permissão' using errcode = '42501'; end if;
  if alvo = uid then raise exception 'ninguém concede capacidade a si mesmo' using errcode = '42501'; end if;
  if cap not in ('admin', 'fotografo') then raise exception 'capacidade inválida' using errcode = '22023'; end if;
  if not exists (select 1 from public.usuarios u where u.id = alvo) then raise exception 'usuário inexistente' using errcode = '23503'; end if;
  insert into public.capacidades (usuario_id, capacidade, concedida_por, concedida_em, revogada_em, motivo)
    values (alvo, cap, uid, now(), null, motivo_txt)
    on conflict (usuario_id, capacidade) do update set concedida_por = excluded.concedida_por, concedida_em = now(), revogada_em = null, motivo = excluded.motivo;
  insert into public.acoes_admin (admin_id, alvo_usuario_id, acao, motivo, contexto) values (uid, alvo, 'concede_' || cap, motivo_txt, '{}'::jsonb);
end $$;

-- Revoga uma capacidade. Recusa alvo = chamador. Para 'admin', remove também o e-mail da tabela legada admins
-- na mesma transação, para que nenhum rollback do modo duplo reabilite quem foi revogado.
create or replace function public.revogar_capacidade(alvo uuid, cap text, motivo_txt text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); em text;
begin
  if uid is null or not public.eh_admin() then raise exception 'sem permissão' using errcode = '42501'; end if;
  if alvo = uid then raise exception 'ninguém revoga a própria capacidade' using errcode = '42501'; end if;
  update public.capacidades set revogada_em = now(), motivo = coalesce(motivo_txt, motivo)
    where usuario_id = alvo and capacidade = cap and revogada_em is null;
  if not found then raise exception 'capacidade não estava ativa' using errcode = 'P0002'; end if;
  if cap = 'admin' then
    select lower(u.email) into em from auth.users u where u.id = alvo;
    delete from public.admins a where lower(a.email) = em;
  end if;
  insert into public.acoes_admin (admin_id, alvo_usuario_id, acao, motivo, contexto)
    values (uid, alvo, 'revoga_' || cap, motivo_txt, jsonb_build_object('email_legado_removido', em));
end $$;
revoke all on function public.conceder_capacidade(uuid, text, text) from public, anon;
revoke all on function public.revogar_capacidade(uuid, text, text) from public, anon;
grant execute on function public.conceder_capacidade(uuid, text, text) to authenticated;
grant execute on function public.revogar_capacidade(uuid, text, text) to authenticated;
