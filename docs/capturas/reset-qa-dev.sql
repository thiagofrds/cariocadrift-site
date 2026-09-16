-- Devolve a conta de QA "piloto" do DEV ao estado inicial (@ pendente, perfil privado, sem foto, sem associação, sem capacidade),
-- para o roteiro qa-etapa-b-dev.js poder rodar de novo. Rodar no SQL Editor do projeto DEV (nunca em produção).
delete from public.associacoes where usuario_id = '33fabc2e-6abc-47aa-8ac3-6aad0024ccc2';
delete from public.capacidades where usuario_id = '33fabc2e-6abc-47aa-8ac3-6aad0024ccc2';
delete from public.acoes_admin;
delete from public.acoes_usuario where usuario_id = '33fabc2e-6abc-47aa-8ac3-6aad0024ccc2';
update public.usuarios set handle = null, estado_cadastro = 'handle_pendente', perfil_publico = false, avatar_path = null,
  apresentacao = null, instagram = null, telefone = null where id = '33fabc2e-6abc-47aa-8ac3-6aad0024ccc2';
select handle, estado_cadastro, perfil_publico from public.usuarios where id = '33fabc2e-6abc-47aa-8ac3-6aad0024ccc2';
