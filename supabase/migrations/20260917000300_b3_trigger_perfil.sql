-- ETAPA B · B3: criação automática do perfil ao criar a conta (gatilho em auth.users).
-- O @ vem do metadado do cadastro, já verificado no cliente; o gatilho revalida e, em colisão ou valor inválido,
-- grava handle nulo com estado 'handle_pendente'. Nunca deriva handle do e-mail. Idempotente (on conflict do nothing).
-- Reversão: drop trigger cria_perfil_usuario on auth.users; drop function public.cria_perfil_usuario();

create or replace function public.cria_perfil_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
        n text; ne text; pref text; h text; est text := 'completo'; aceite timestamptz;
begin
  n := btrim(coalesce(m ->> 'nome', ''));
  if char_length(n) < 2 then n := 'Nova conta'; end if;
  n := left(n, 120);
  ne := left(btrim(coalesce(nullif(m ->> 'nome_exibicao', ''), split_part(n, ' ', 1))), 40);
  if char_length(ne) < 2 then ne := left(n, 40); end if;
  pref := case when m ->> 'preferencia' in ('piloto', 'espectador') then m ->> 'preferencia' else 'espectador' end;
  aceite := case when (m ->> 'aceite') in ('true', '1') then now() else null end;
  h := public.normalizar_handle(m ->> 'handle');
  if h is null or exists (select 1 from public.handles_reservados r where r.handle = h) then h := null; end if;
  if h is null then est := 'handle_pendente'; end if;
  begin
    insert into public.usuarios (id, handle, nome, nome_exibicao, preferencia, estado_cadastro, aceite_termos_em)
      values (new.id, h, n, ne, pref, est, aceite)
      on conflict (id) do nothing;
  exception when unique_violation then
    -- colisão de handle em cadastros simultâneos: a conta nasce sem handle, e o site pede outro na primeira entrada
    insert into public.usuarios (id, handle, nome, nome_exibicao, preferencia, estado_cadastro, aceite_termos_em)
      values (new.id, null, n, ne, pref, 'handle_pendente', aceite)
      on conflict (id) do nothing;
  end;
  return new;
end $$;
revoke all on function public.cria_perfil_usuario() from public, anon, authenticated;
create trigger cria_perfil_usuario after insert on auth.users for each row execute function public.cria_perfil_usuario();
