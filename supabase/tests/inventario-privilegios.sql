-- Inventário de privilégios dos papéis da API (anon, authenticated, PUBLIC) no schema public. Só leitura.
\pset format aligned
select 'TABELAS' as secao, grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC')
group by grantee, table_name order by table_name, grantee;
select 'COLUNAS (só onde não há privilégio de tabela inteira)' as secao, c.grantee, c.table_name, c.privilege_type, string_agg(c.column_name, ',' order by c.column_name) as colunas
from information_schema.role_column_grants c
where c.table_schema = 'public' and c.grantee in ('anon','authenticated','PUBLIC')
  and not exists (select 1 from information_schema.role_table_grants t where t.table_schema = c.table_schema and t.table_name = c.table_name and t.grantee = c.grantee and t.privilege_type = c.privilege_type)
group by c.grantee, c.table_name, c.privilege_type order by c.table_name, c.grantee, c.privilege_type;
select 'FUNCOES' as secao, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as funcao,
  has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
  has_function_privilege('service_role', p.oid, 'execute') as service_role, p.prosecdef as definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 2;
select 'SEQUENCIAS' as secao, c.relname, has_sequence_privilege('anon', c.oid, 'usage') as anon_usage, has_sequence_privilege('authenticated', c.oid, 'usage') as auth_usage
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'S' order by 2;
select 'PADRAO' as secao, pg_get_userbyid(defaclrole) as papel, defaclobjtype as tipo, array_to_string(defaclacl, ' ') as acl
from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' order by 2, 3;
select 'RLS' as secao, tablename, rowsecurity from pg_tables where schemaname = 'public' order by 2;
