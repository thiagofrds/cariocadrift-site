-- ETAPA B · B2: normalização, disponibilidade e definição do @ (handle).
-- Reversão: drop function public.definir_handle(text), public.handle_disponivel(text), public.normalizar_handle(text); drop table public.tentativas_handle;

-- Normaliza: minúsculas, sem acento (mapa manual, sem depender da extensão unaccent), só [a-z0-9_], 3 a 24, sem _ nas pontas, sem __.
create or replace function public.normalizar_handle(entrada text) returns text
language sql immutable strict set search_path = '' as $$
  select case
    when h ~ '^[a-z0-9][a-z0-9_]{1,22}[a-z0-9]$' and h !~ '__' then h
    else null end
  from (select regexp_replace(translate(lower(btrim(entrada)), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9_]', '', 'g') as h) x
$$;

-- limite de consultas de disponibilidade (sem IP no banco: limite global por janela, ajustável)
create table public.tentativas_handle (criado_em timestamptz not null default now());
create index tentativas_handle_criado_em on public.tentativas_handle (criado_em);
alter table public.tentativas_handle enable row level security;
revoke all on public.tentativas_handle from public, anon, authenticated;

-- Disponibilidade: devolve só booleano e até 3 sugestões derivadas do próprio texto. Nunca lê dados de outros usuários.
create or replace function public.handle_disponivel(entrada text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h text; livre boolean; sug text[] := '{}'; cand text; i int;
begin
  perform pg_advisory_xact_lock(hashtext('tentativas_handle'));
  if (select count(*) from public.tentativas_handle where criado_em > now() - interval '10 minutes') >= 600 then
    raise exception 'limite de consultas atingido, tente mais tarde' using errcode = 'P0001';
  end if;
  insert into public.tentativas_handle default values;
  delete from public.tentativas_handle where criado_em < now() - interval '1 hour';
  h := public.normalizar_handle(entrada);
  if h is null then return jsonb_build_object('valido', false, 'disponivel', false, 'sugestoes', '[]'::jsonb); end if;
  livre := not exists (select 1 from public.handles_reservados r where r.handle = h)
       and not exists (select 1 from public.usuarios u where u.handle = h);
  if not livre then
    foreach cand in array array[h || '_rj', h || '_drift', h || '_' || to_char(now(), 'YY'), h || '2', h || '3'] loop
      if char_length(cand) <= 24 and cand !~ '__' and cand ~ '[a-z0-9]$'
         and not exists (select 1 from public.handles_reservados r where r.handle = cand)
         and not exists (select 1 from public.usuarios u where u.handle = cand) then
        sug := sug || cand;
      end if;
      exit when array_length(sug, 1) >= 3;
    end loop;
  end if;
  return jsonb_build_object('valido', true, 'disponivel', livre, 'handle', h, 'sugestoes', to_jsonb(sug));
end $$;
-- exposta a visitantes (verificação durante o cadastro) e logados; sem lista de handles, só sim/não e sugestões
revoke all on function public.handle_disponivel(text) from public;
grant execute on function public.handle_disponivel(text) to anon, authenticated;
revoke all on function public.normalizar_handle(text) from public, anon, authenticated;

-- Define o @ de uma conta pendente. Só o próprio usuário, só quando ainda não tem handle.
create or replace function public.definir_handle(entrada text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h text; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  h := public.normalizar_handle(entrada);
  if h is null then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if exists (select 1 from public.handles_reservados r where r.handle = h) then return jsonb_build_object('ok', false, 'motivo', 'reservado'); end if;
  if not exists (select 1 from public.usuarios u where u.id = uid and u.handle is null) then
    return jsonb_build_object('ok', false, 'motivo', 'ja_definido');
  end if;
  begin
    update public.usuarios set handle = h, estado_cadastro = 'completo' where id = uid and handle is null;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end;
  insert into public.acoes_usuario (usuario_id, acao, contexto) values (uid, 'handle_definido', jsonb_build_object('handle', h));
  return jsonb_build_object('ok', true, 'handle', h);
end $$;
revoke all on function public.definir_handle(text) from public, anon;
grant execute on function public.definir_handle(text) to authenticated;
