-- ETAPA B · B7: bucket privado de avatares. Caminho: <uid>/<arquivo>. Entrega só por URL assinada curta;
-- a API de storage só assina se a policy de SELECT passar (dono, admin, ou dono com perfil público).
-- Reversão: drop policy ... on storage.objects (as quatro abaixo); delete from storage.buckets where id = 'avatares';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatares', 'avatares', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

-- Policies de storage rodam com os privilégios do papel da API, que não lê public.usuarios; por isso a decisão de
-- visibilidade fica numa função security definer (mesma regra da projeção pública).
create or replace function public.avatar_visivel(nome text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare pasta text := (storage.foldername(nome))[1];
begin
  return coalesce(pasta = auth.uid()::text, false)
      or public.eh_admin()
      or exists (select 1 from public.usuarios u where u.id::text = pasta and u.perfil_publico and u.estado_cadastro = 'completo');
end $$;
grant execute on function public.avatar_visivel(text) to anon, authenticated;

create policy "avatares: le dono, admin ou perfil publico" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatares' and public.avatar_visivel(name));
create policy "avatares: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatares: dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatares: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
