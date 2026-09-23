-- ============================================================================
-- MIGRATION: 20260923050000_security_audit_rls_rpcs_triggers.sql
-- VERSÃO: v0.0.106 - SEGURANÇA E INTEGRIDADE DE DADOS
-- 
-- 1. CORREÇÃO DE VAZAMENTO ENTRE EMPRESAS (REMOÇÃO DE "OR is_master()")
-- 2. BLOQUEIO DE ESCALADA DE PRIVILÉGIOS NA TABELA usuarios (TRIGGER + POLICIES)
-- 3. AUDITORIA E ENDURECIMENTO DE RPCs SECURITY DEFINER
-- ============================================================================

-- ============================================================================
-- PARTE 1: CORREÇÃO DAS POLICIES RLS (ISOLAMENTO MULTI-TENANT RIGOROSO)
-- ============================================================================

-- 1. assinaturas
DROP POLICY IF EXISTS "assinaturas_select_empresa" ON public.assinaturas;
CREATE POLICY "assinaturas_select_empresa" ON public.assinaturas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 2. categorias
DROP POLICY IF EXISTS "categorias_select_empresa" ON public.categorias;
CREATE POLICY "categorias_select_empresa" ON public.categorias
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 3. clientes
DROP POLICY IF EXISTS "clientes_select_empresa" ON public.clientes;
CREATE POLICY "clientes_select_empresa" ON public.clientes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 4. comissoes
DROP POLICY IF EXISTS "comissoes_select_empresa" ON public.comissoes;
CREATE POLICY "comissoes_select_empresa" ON public.comissoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 5. compras (SELECT, UPDATE, INSERT ajustado para authenticated)
DROP POLICY IF EXISTS "compras_select_empresa" ON public.compras;
CREATE POLICY "compras_select_empresa" ON public.compras
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "compras_update_empresa" ON public.compras;
CREATE POLICY "compras_update_empresa" ON public.compras
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin() OR public.is_manager_or_above() OR public.is_operador_or_above()))
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin() OR public.is_manager_or_above() OR public.is_operador_or_above()));

DROP POLICY IF EXISTS "compras_insert_empresa" ON public.compras;
CREATE POLICY "compras_insert_empresa" ON public.compras
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin() OR public.is_manager_or_above() OR public.is_operador_or_above()));

-- 6. contas_pagar
DROP POLICY IF EXISTS "contas_pagar_select_empresa" ON public.contas_pagar;
CREATE POLICY "contas_pagar_select_empresa" ON public.contas_pagar
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 7. contas_receber
DROP POLICY IF EXISTS "contas_receber_select_empresa" ON public.contas_receber;
CREATE POLICY "contas_receber_select_empresa" ON public.contas_receber
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 8. empresas
DROP POLICY IF EXISTS "empresas_select_propria" ON public.empresas;
CREATE POLICY "empresas_select_propria" ON public.empresas
  FOR SELECT TO authenticated
  USING (id = public.get_my_empresa_id());

-- 9. estoques
DROP POLICY IF EXISTS "estoques_select_empresa" ON public.estoques;
CREATE POLICY "estoques_select_empresa" ON public.estoques
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 10. fornecedores
DROP POLICY IF EXISTS "fornecedores_select_empresa" ON public.fornecedores;
CREATE POLICY "fornecedores_select_empresa" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 11. itens_compra (SELECT, UPDATE, DELETE, INSERT ajustado para authenticated)
DROP POLICY IF EXISTS "itens_compra_select_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_select_empresa" ON public.itens_compra
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "itens_compra_update_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_update_empresa" ON public.itens_compra
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin() OR public.is_manager_or_above() OR public.is_operador_or_above()))
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin() OR public.is_manager_or_above() OR public.is_operador_or_above()));

DROP POLICY IF EXISTS "itens_compra_delete_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_delete_empresa" ON public.itens_compra
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin() OR public.is_manager_or_above() OR public.is_operador_or_above()));

DROP POLICY IF EXISTS "itens_compra_insert_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_insert_empresa" ON public.itens_compra
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin() OR public.is_manager_or_above() OR public.is_operador_or_above()));

-- 12. itens_pedido
DROP POLICY IF EXISTS "itens_pedido_select_empresa" ON public.itens_pedido;
CREATE POLICY "itens_pedido_select_empresa" ON public.itens_pedido
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 13. itens_venda
DROP POLICY IF EXISTS "itens_venda_select_empresa" ON public.itens_venda;
CREATE POLICY "itens_venda_select_empresa" ON public.itens_venda
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 14. movimentacoes_estoque
DROP POLICY IF EXISTS "movimentacoes_select_empresa" ON public.movimentacoes_estoque;
CREATE POLICY "movimentacoes_select_empresa" ON public.movimentacoes_estoque
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 15. pedidos
DROP POLICY IF EXISTS "pedidos_select_empresa" ON public.pedidos;
CREATE POLICY "pedidos_select_empresa" ON public.pedidos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 16. produtos
DROP POLICY IF EXISTS "produtos_select_empresa" ON public.produtos;
CREATE POLICY "produtos_select_empresa" ON public.produtos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 17. usuarios (SELECT e UPDATE)
DROP POLICY IF EXISTS "usuarios_select_empresa" ON public.usuarios;
CREATE POLICY "usuarios_select_empresa" ON public.usuarios
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "usuarios_update_empresa" ON public.usuarios;
CREATE POLICY "usuarios_update_empresa" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin()))
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_master() OR public.is_admin()));

-- 18. vendas
DROP POLICY IF EXISTS "vendas_select_empresa" ON public.vendas;
CREATE POLICY "vendas_select_empresa" ON public.vendas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 19. vendedores
DROP POLICY IF EXISTS "vendedores_select_empresa" ON public.vendedores;
CREATE POLICY "vendedores_select_empresa" ON public.vendedores
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());


-- ============================================================================
-- PARTE 2: TRIGGER DE PROTEÇÃO CONTRA ESCALADA DE PRIVILÉGIOS EM usuarios
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_proteger_usuarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_auth_uid uuid;
  v_caller_perfil text;
  v_caller_empresa_id uuid;
  v_caller_is_platform boolean := false;
BEGIN
  -- Identificar chamador
  v_caller_auth_uid := auth.uid();

  -- Se for service_role / chamada interna sem auth.uid() (ex: migrations, triggers do sistema)
  -- permitir execução de manutenção
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') OR v_caller_auth_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obter perfil do chamador autenticado
  SELECT perfil, empresa_id INTO v_caller_perfil, v_caller_empresa_id
  FROM public.usuarios
  WHERE auth_user_id = v_caller_auth_uid
    AND ativo = true
  LIMIT 1;

  IF v_caller_perfil = 'platform_admin' THEN
    v_caller_is_platform := true;
  END IF;

  -- ----------------------------------------------------
  -- REGRAS PARA INSERT
  -- ----------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    -- a) Impede definir perfil = 'platform_admin' a menos que quem executa seja platform_admin
    IF NEW.perfil = 'platform_admin' AND NOT v_caller_is_platform THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores da plataforma podem criar usuários com este perfil.';
    END IF;

    -- Se não for platform_admin, o empresa_id do novo usuário deve ser estritamente o do chamador
    IF NOT v_caller_is_platform THEN
      IF NEW.empresa_id IS NULL OR NEW.empresa_id <> v_caller_empresa_id THEN
        RAISE EXCEPTION 'Acesso negado: não é permitido cadastrar usuários para outra empresa.';
      END IF;

      -- Apenas master pode conceder o perfil 'master'
      IF NEW.perfil = 'master' AND v_caller_perfil <> 'master' THEN
        RAISE EXCEPTION 'Acesso negado: apenas usuários Master podem criar outros usuários Master.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ----------------------------------------------------
  -- REGRAS PARA UPDATE
  -- ----------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- Se for platform_admin, tem permissão administrativa global
    IF v_caller_is_platform THEN
      RETURN NEW;
    END IF;

    -- b) Impede alterar empresa_id e auth_user_id via API
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RAISE EXCEPTION 'Acesso negado: a alteração do empresa_id de um usuário é estritamente proibida.';
    END IF;

    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
      RAISE EXCEPTION 'Acesso negado: a alteração do auth_user_id de um usuário é estritamente proibida.';
    END IF;

    -- a) Impede definir perfil = 'platform_admin' ou alterar um registro que já é platform_admin
    IF (NEW.perfil = 'platform_admin' OR OLD.perfil = 'platform_admin') AND NOT v_caller_is_platform THEN
      RAISE EXCEPTION 'Acesso negado: privilégios insuficientes para interagir com o perfil platform_admin.';
    END IF;

    -- c) Impede o usuário de alterar o PRÓPRIO perfil
    IF OLD.auth_user_id = v_caller_auth_uid AND NEW.perfil IS DISTINCT FROM OLD.perfil THEN
      RAISE EXCEPTION 'Acesso negado: não é permitido alterar o seu próprio perfil de acesso.';
    END IF;

    -- d) Somente master pode conceder ou remover o perfil 'master'; admin não pode promover ninguém a master
    IF (NEW.perfil = 'master' OR OLD.perfil = 'master') AND NEW.perfil IS DISTINCT FROM OLD.perfil THEN
      IF v_caller_perfil <> 'master' THEN
        RAISE EXCEPTION 'Acesso negado: apenas usuários com perfil Master podem conceder ou remover a titularidade Master.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_usuarios_trigger ON public.usuarios;
CREATE TRIGGER trg_proteger_usuarios_trigger
  BEFORE INSERT OR UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_proteger_usuarios();


-- ============================================================================
-- PARTE 3: ENDURECIMENTO DAS FUNÇÕES SECURITY DEFINER
-- ============================================================================

-- Endurecer validar_limite_usuarios para garantir que se o chamador for do tenant,
-- ele só valida para sua própria empresa (a menos que seja platform_admin ou service_role)
CREATE OR REPLACE FUNCTION public.validar_limite_usuarios(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite integer;
  v_count integer;
  v_assinatura_id uuid;
  v_caller_empresa_id uuid;
BEGIN
  -- Se for chamado por usuário autenticado que NÃO seja platform_admin, travar na própria empresa
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    v_caller_empresa_id := public.get_my_empresa_id();
    IF v_caller_empresa_id IS NOT NULL AND p_empresa_id <> v_caller_empresa_id THEN
      RETURN jsonb_build_object(
        'permitido', false,
        'erro', 'Acesso negado: empresa inválida.'
      );
    END IF;
  END IF;

  -- Travar assinatura para serializar a validação e obter limite
  SELECT a.id, p.limite_usuarios
  INTO v_assinatura_id, v_limite
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = p_empresa_id
  FOR UPDATE OF a;

  -- Se não achou assinatura, bloqueia
  IF v_assinatura_id IS NULL THEN
    RETURN jsonb_build_object(
      'permitido', false,
      'erro', 'Nenhuma assinatura ativa encontrada para esta empresa.'
    );
  END IF;

  -- Se limite for NULL ou ilimitado (ex: -1), permitido
  IF v_limite IS NULL OR v_limite <= 0 THEN
    RETURN jsonb_build_object(
      'permitido', true,
      'limite', v_limite,
      'atual', 0
    );
  END IF;

  -- Contar usuários ativos atuais da empresa
  SELECT count(*)
  INTO v_count
  FROM public.usuarios
  WHERE empresa_id = p_empresa_id
    AND ativo = true;

  IF v_count >= v_limite THEN
    RETURN jsonb_build_object(
      'permitido', false,
      'erro', format('Limite de usuários do plano atingido (%s/%s). Faça upgrade do plano para adicionar mais usuários.', v_count, v_limite),
      'limite', v_limite,
      'atual', v_count
    );
  END IF;

  RETURN jsonb_build_object(
    'permitido', true,
    'limite', v_limite,
    'atual', v_count
  );
END;
$$;

-- Revogar EXECUTE de anon e public de todas as rotinas administrativas via loop dinâmico seguro
DO $$
DECLARE
  v_func text;
  v_funcs text[] := ARRAY[
    'validar_limite_usuarios',
    'bloquear_empresa',
    'desbloquear_empresa',
    'alterar_plano_admin',
    'criar_plano_admin',
    'editar_plano_admin',
    'toggle_plano_ativo',
    'listar_empresas_admin',
    'listar_planos_admin',
    'listar_historico_admin',
    'listar_historico_empresa_admin',
    'get_admin_dashboard',
    'get_historico_financeiro_admin',
    'get_kpis_assinaturas_admin',
    'listar_assinaturas_admin',
    'criar_empresa_manual_admin',
    'editar_empresa_cadastral_admin',
    'atualizar_assinatura_manual_admin',
    'registrar_pagamento_manual_admin',
    'rollback_empresa_manual_admin'
  ];
  r record;
BEGIN
  FOREACH v_func IN ARRAY v_funcs LOOP
    FOR r IN (
      SELECT p.oid, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = v_func
    ) LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM anon, public;', v_func, r.args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role;', v_func, r.args);
    END LOOP;
  END LOOP;
END $$;
