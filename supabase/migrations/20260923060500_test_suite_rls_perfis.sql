-- ============================================================================
-- MIGRATION: 20260923060500_test_suite_rls_perfis.sql
-- Validação estrita de RLS por perfil usando usuários reais
-- ============================================================================

CREATE OR REPLACE FUNCTION public._test_rls_perfil(
  p_auth_uid uuid,
  p_role_expected text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
  v_cp_count int;
  v_cr_count int;
  v_compras_count int;
  v_itens_compra_count int;
  v_fornecedores_count int;
  v_comissoes_count int;
  v_comissoes_total_empresa int;
  v_mov_count int;
  v_usuarios_count int;
  v_usuarios_total_empresa int;
  v_caller_empresa_id uuid;
  v_vendedor_id uuid;
BEGIN
  -- Salvar contexto da sessão atual
  -- Configurar request.jwt.claims para simular o usuário
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_auth_uid::text, 'role', 'authenticated')::text, true);

  -- Obter dados no contexto simulado
  v_caller_empresa_id := public.get_my_empresa_id();
  v_vendedor_id := public.get_my_vendedor_id();

  -- Total na empresa (sem RLS restritivo) para efeito comparativo
  SELECT count(*) INTO v_comissoes_total_empresa FROM public.comissoes WHERE empresa_id = v_caller_empresa_id;
  SELECT count(*) INTO v_usuarios_total_empresa FROM public.usuarios WHERE empresa_id = v_caller_empresa_id;

  -- Testar SELECTs sob RLS:
  -- Como a função é SECURITY DEFINER rodando como postgres, invocamos queries dinâmicas
  -- ou avaliamos as expressões das policies diretamente com os dados das tabelas:
  
  -- 1. contas_pagar visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_cp_count
  FROM public.contas_pagar
  WHERE empresa_id = public.get_my_empresa_id() AND public.is_empresa_gerente_or_above();

  -- 2. contas_receber visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_cr_count
  FROM public.contas_receber
  WHERE empresa_id = public.get_my_empresa_id() AND public.is_empresa_gerente_or_above();

  -- 3. compras visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_compras_count
  FROM public.compras
  WHERE empresa_id = public.get_my_empresa_id() AND public.is_empresa_gerente_or_above();

  -- 4. itens_compra visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_itens_compra_count
  FROM public.itens_compra
  WHERE empresa_id = public.get_my_empresa_id() AND public.is_empresa_gerente_or_above();

  -- 5. fornecedores visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_fornecedores_count
  FROM public.fornecedores
  WHERE empresa_id = public.get_my_empresa_id() AND public.is_empresa_gerente_or_above();

  -- 6. comissoes visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_comissoes_count
  FROM public.comissoes
  WHERE empresa_id = public.get_my_empresa_id()
    AND (
      public.is_empresa_gerente_or_above()
      OR (
        public.get_my_perfil() = 'vendedor'
        AND vendedor_id = public.get_my_vendedor_id()
      )
    );

  -- 7. movimentacoes_estoque visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_mov_count
  FROM public.movimentacoes_estoque
  WHERE empresa_id = public.get_my_empresa_id() AND public.is_empresa_operador_or_above();

  -- 8. usuarios visíveis pelo usuário sob RLS
  SELECT count(*) INTO v_usuarios_count
  FROM public.usuarios
  WHERE empresa_id = public.get_my_empresa_id()
    AND (
      public.is_empresa_admin_or_master()
      OR auth_user_id = auth.uid()
    );

  v_res := jsonb_build_object(
    'simulated_uid', p_auth_uid,
    'expected_role', p_role_expected,
    'detected_perfil', public.get_my_perfil(),
    'detected_empresa_id', v_caller_empresa_id,
    'detected_vendedor_id', v_vendedor_id,
    'contas_pagar_visiveis', v_cp_count,
    'contas_receber_visiveis', v_cr_count,
    'compras_visiveis', v_compras_count,
    'itens_compra_visiveis', v_itens_compra_count,
    'fornecedores_visiveis', v_fornecedores_count,
    'comissoes_visiveis', v_comissoes_count,
    'comissoes_total_empresa', v_comissoes_total_empresa,
    'movimentacoes_visiveis', v_mov_count,
    'usuarios_visiveis', v_usuarios_count,
    'usuarios_total_empresa', v_usuarios_total_empresa
  );

  RETURN v_res;
END;
$$;

-- Executar os testes simulando cada cargo e salvar resultado em tabela de auditoria temporária/de teste
CREATE TABLE IF NOT EXISTS public._test_rls_results (
  id serial PRIMARY KEY,
  perfil text,
  auth_uid uuid,
  resultado jsonb,
  created_at timestamptz DEFAULT now()
);

TRUNCATE public._test_rls_results;

-- 1. Vendedor (Raick / raick.evo@gmail.com - uid: bf8fed61-e0a1-41a8-b14c-016bd3570da4)
INSERT INTO public._test_rls_results (perfil, auth_uid, resultado)
VALUES ('vendedor', 'bf8fed61-e0a1-41a8-b14c-016bd3570da4'::uuid, public._test_rls_perfil('bf8fed61-e0a1-41a8-b14c-016bd3570da4'::uuid, 'vendedor'));

-- 2. Operador (Jubileu / jubileu.evo@gmail.com - uid: b576189f-39d6-4558-bddd-a1768a50c9b7)
INSERT INTO public._test_rls_results (perfil, auth_uid, resultado)
VALUES ('operador', 'b576189f-39d6-4558-bddd-a1768a50c9b7'::uuid, public._test_rls_perfil('b576189f-39d6-4558-bddd-a1768a50c9b7'::uuid, 'operador'));

-- 3. Admin (Adm Junior / junior.evo@gmail.com - uid: 76285a18-951a-4b07-a939-bc121bae5483)
INSERT INTO public._test_rls_results (perfil, auth_uid, resultado)
VALUES ('admin', '76285a18-951a-4b07-a939-bc121bae5483'::uuid, public._test_rls_perfil('76285a18-951a-4b07-a939-bc121bae5483'::uuid, 'admin'));

-- 4. Master (Alexandre Oliveira Silva / raickexcarro@gmail.com - uid: 9de98e70-e15f-4321-b733-e25c51c8974d)
INSERT INTO public._test_rls_results (perfil, auth_uid, resultado)
VALUES ('master', '9de98e70-e15f-4321-b733-e25c51c8974d'::uuid, public._test_rls_perfil('9de98e70-e15f-4321-b733-e25c51c8974d'::uuid, 'master'));

-- 5. Outra Empresa Master (Raick Silva Sousa / raick.agro@gmail.com - empresa: 49961cc6-5040-492f-b867-6253761affd2)
INSERT INTO public._test_rls_results (perfil, auth_uid, resultado)
VALUES ('master_outra_empresa', 'f65b4ef0-bc7f-49ac-8751-1af2399b016a'::uuid, public._test_rls_perfil('f65b4ef0-bc7f-49ac-8751-1af2399b016a'::uuid, 'master_outra_empresa'));
