-- ETAPA B · B5: eh_admin() em modo duplo, com precedência de capacidades.
-- (a) se existe QUALQUER linha capacidades(admin) para o usuário, ativa ou revogada, ela é a única fonte: verdadeiro só se ativa;
-- (b) só se não existe linha nenhuma, consulta o e-mail na tabela legada admins (fallback exclusivo de quem ainda não foi migrado).
-- Nenhuma policy muda de texto. Reversão: restaurar o corpo anterior (abaixo, em comentário) em uma migration de uma linha.
--   create or replace function public.eh_admin() returns boolean language sql stable security definer set search_path = '' as $$
--     select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email')); $$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.capacidades c where c.usuario_id = auth.uid() and c.capacidade = 'admin')
      then exists (select 1 from public.capacidades c where c.usuario_id = auth.uid() and c.capacidade = 'admin' and c.revogada_em is null)
    else exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email'))
  end
$$;
-- usada dentro de policies: precisa continuar executável por anon e authenticated
grant execute on function public.eh_admin() to anon, authenticated;

-- Origem da permissão, para o painel exibir durante a transição
create or replace function public.origem_admin() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.capacidades c where c.usuario_id = auth.uid() and c.capacidade = 'admin' and c.revogada_em is null) then 'capacidades'
    when exists (select 1 from public.capacidades c where c.usuario_id = auth.uid() and c.capacidade = 'admin') then 'revogado'
    when exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email')) then 'legado'
    else 'nenhuma' end
$$;
revoke all on function public.origem_admin() from public, anon;
grant execute on function public.origem_admin() to authenticated;
