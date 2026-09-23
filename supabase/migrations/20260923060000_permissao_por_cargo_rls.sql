-- ============================================================================
-- MIGRATION: 20260923060000_permissao_por_cargo_rls.sql
-- VERSÃO: v0.0.109 - SEGURANÇA: PERMISSÃO POR CARGO NO BANCO (RODADA B1)
--
-- 1. FUNÇÕES AUXILIARES SECURITY DEFINER COM SEARCH_PATH FIXO:
--    - get_my_perfil(): Retorna o perfil do usuário logado (usuarios.perfil)
--    - get_my_vendedor_id(): Retorna o vendedor_id vinculado ao usuário logado
--    - is_empresa_gerente_or_above(): true se perfil IN ('master', 'admin', 'gerente')
--    - is_empresa_operador_or_above(): true se perfil IN ('master', 'admin', 'gerente', 'operador')
--    - is_empresa_admin_or_master(): true se perfil IN ('master', 'admin')
--
-- 2. AJUSTE DE POLICIES RLS (SELECT e escrita onde existirem):
--    - contas_pagar, contas_receber, compras, itens_compra, fornecedores:
--      Apenas master, admin, gerente da própria empresa.
--    - comissoes:
--      Master, admin, gerente veem todas da empresa.
--      Vendedor vê SOMENTE as suas comissões (vendedor_id = get_my_vendedor_id()).
--    - movimentacoes_estoque:
--      Master, admin, gerente, operador da própria empresa.
--    - usuarios:
--      Master e admin veem todos da própria empresa.
--      Demais perfis (gerente, vendedor, operador) veem SOMENTE o próprio registro (id = get_my_usuario_id() ou auth_user_id = auth.uid()).
--
--    * NOTA DE SEGURANÇA: Todas as checagens mantêm estritamente o isolamento
--      multi-tenant empresa_id = get_my_empresa_id().
--      Políticas para platform_admin continuam ativas para o painel de plataforma.
-- ============================================================================

-- ============================================================================
-- PARTE 1: FUNÇÕES AUXILIARES SECURITY DEFINER
-- ============================================================================

-- 1.1 get_my_perfil(): Retorna o perfil do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_perfil()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil
  FROM public.usuarios
  WHERE auth_user_id = auth.uid()
    AND ativo = true
  LIMIT 1;
$$;

-- 1.2 get_my_usuario_id(): Retorna o id da tabela usuarios para o auth.uid() atual
CREATE OR REPLACE FUNCTION public.get_my_usuario_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.usuarios
  WHERE auth_user_id = auth.uid()
    AND ativo = true
  LIMIT 1;
$$;

-- 1.3 get_my_vendedor_id(): Retorna o id do vendedor vinculado ao usuário autenticado
CREATE OR REPLACE FUNCTION public.get_my_vendedor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id
  FROM public.vendedores v
  JOIN public.usuarios u ON u.id = v.usuario_id
  WHERE u.auth_user_id = auth.uid()
    AND u.ativo = true
    AND v.ativo = true
  LIMIT 1;
$$;

-- 1.4 is_empresa_gerente_or_above(): true para master, admin ou gerente ativos
CREATE OR REPLACE FUNCTION public.is_empresa_gerente_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND ativo = true
      AND perfil IN ('master', 'admin', 'gerente')
  );
$$;

-- 1.5 is_empresa_operador_or_above(): true para master, admin, gerente ou operador ativos
CREATE OR REPLACE FUNCTION public.is_empresa_operador_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND ativo = true
      AND perfil IN ('master', 'admin', 'gerente', 'operador')
  );
$$;

-- 1.6 is_empresa_admin_or_master(): true para master ou admin ativos
CREATE OR REPLACE FUNCTION public.is_empresa_admin_or_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND ativo = true
      AND perfil IN ('master', 'admin')
  );
$$;

-- Conceder permissões de execução para authenticated e service_role
GRANT EXECUTE ON FUNCTION public.get_my_perfil() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_usuario_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_vendedor_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_empresa_gerente_or_above() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_empresa_operador_or_above() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_empresa_admin_or_master() TO authenticated, service_role;


-- ============================================================================
-- PARTE 2: POLICIES RLS PARA CONTAS_PAGAR
-- Regra: Apenas master, admin e gerente da própria empresa.
-- ============================================================================

DROP POLICY IF EXISTS "contas_pagar_select_empresa" ON public.contas_pagar;
CREATE POLICY "contas_pagar_select_empresa" ON public.contas_pagar
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "contas_pagar_insert_empresa" ON public.contas_pagar;
CREATE POLICY "contas_pagar_insert_empresa" ON public.contas_pagar
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "contas_pagar_update_empresa" ON public.contas_pagar;
CREATE POLICY "contas_pagar_update_empresa" ON public.contas_pagar
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );


-- ============================================================================
-- PARTE 3: POLICIES RLS PARA CONTAS_RECEBER
-- Regra: Apenas master, admin e gerente da própria empresa.
-- ============================================================================

DROP POLICY IF EXISTS "contas_receber_select_empresa" ON public.contas_receber;
CREATE POLICY "contas_receber_select_empresa" ON public.contas_receber
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "contas_receber_insert_empresa" ON public.contas_receber;
CREATE POLICY "contas_receber_insert_empresa" ON public.contas_receber
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "contas_receber_update_empresa" ON public.contas_receber;
CREATE POLICY "contas_receber_update_empresa" ON public.contas_receber
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );


-- ============================================================================
-- PARTE 4: POLICIES RLS PARA FORNECEDORES
-- Regra: Apenas master, admin e gerente da própria empresa.
-- ============================================================================

DROP POLICY IF EXISTS "fornecedores_select_empresa" ON public.fornecedores;
CREATE POLICY "fornecedores_select_empresa" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "fornecedores_insert_empresa" ON public.fornecedores;
CREATE POLICY "fornecedores_insert_empresa" ON public.fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "fornecedores_update_empresa" ON public.fornecedores;
CREATE POLICY "fornecedores_update_empresa" ON public.fornecedores
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );


-- ============================================================================
-- PARTE 5: POLICIES RLS PARA COMPRAS
-- Regra: Apenas master, admin e gerente da própria empresa.
-- (Operador e vendedor não acessam compras)
-- ============================================================================

DROP POLICY IF EXISTS "compras_select_empresa" ON public.compras;
CREATE POLICY "compras_select_empresa" ON public.compras
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "compras_insert_empresa" ON public.compras;
CREATE POLICY "compras_insert_empresa" ON public.compras
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "compras_update_empresa" ON public.compras;
CREATE POLICY "compras_update_empresa" ON public.compras
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );


-- ============================================================================
-- PARTE 6: POLICIES RLS PARA ITENS_COMPRA
-- Regra: Apenas master, admin e gerente da própria empresa.
-- ============================================================================

DROP POLICY IF EXISTS "itens_compra_select_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_select_empresa" ON public.itens_compra
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "itens_compra_insert_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_insert_empresa" ON public.itens_compra
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "itens_compra_update_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_update_empresa" ON public.itens_compra
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );

DROP POLICY IF EXISTS "itens_compra_delete_empresa" ON public.itens_compra;
CREATE POLICY "itens_compra_delete_empresa" ON public.itens_compra
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_gerente_or_above()
  );


-- ============================================================================
-- PARTE 7: POLICIES RLS PARA COMISSOES
-- Regra:
-- Master, admin e gerente veem todas as comissões da empresa.
-- Vendedor vê SOMENTE as próprias comissões (vendedor_id = get_my_vendedor_id()).
-- ============================================================================

DROP POLICY IF EXISTS "comissoes_select_empresa" ON public.comissoes;
CREATE POLICY "comissoes_select_empresa" ON public.comissoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (
      public.is_empresa_gerente_or_above()
      OR (
        public.get_my_perfil() = 'vendedor'
        AND vendedor_id = public.get_my_vendedor_id()
      )
    )
  );


-- ============================================================================
-- PARTE 8: POLICIES RLS PARA MOVIMENTACOES_ESTOQUE
-- Regra: Master, admin, gerente e operador (is_empresa_operador_or_above).
-- ============================================================================

DROP POLICY IF EXISTS "movimentacoes_select_empresa" ON public.movimentacoes_estoque;
CREATE POLICY "movimentacoes_select_empresa" ON public.movimentacoes_estoque
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_operador_or_above()
  );

DROP POLICY IF EXISTS "movimentacoes_insert_empresa" ON public.movimentacoes_estoque;
CREATE POLICY "movimentacoes_insert_empresa" ON public.movimentacoes_estoque
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_empresa_operador_or_above()
  );


-- ============================================================================
-- PARTE 9: POLICIES RLS PARA USUARIOS
-- Regra:
-- Master e admin veem todos da empresa.
-- Demais cargos (gerente, vendedor, operador) veem SOMENTE o próprio registro.
-- Platform admin continua com acesso via policy específica.
-- ============================================================================

DROP POLICY IF EXISTS "usuarios_select_empresa" ON public.usuarios;
CREATE POLICY "usuarios_select_empresa" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (
      public.is_empresa_admin_or_master()
      OR auth_user_id = auth.uid()
    )
  );
