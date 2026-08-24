-- Policy: Permitir UPDATE em empresas para master/admin da própria empresa
DROP POLICY IF EXISTS empresas_update_propria ON public.empresas;
CREATE POLICY empresas_update_propria ON public.empresas
  FOR UPDATE
  TO authenticated
  USING (id = get_my_empresa_id() AND (is_master() OR is_admin()))
  WITH CHECK (id = get_my_empresa_id() AND (is_master() OR is_admin()));

-- Policy: Permitir UPDATE em usuarios para master/admin da mesma empresa
-- (para toggle ativo e alteração de perfil)
DROP POLICY IF EXISTS usuarios_update_empresa ON public.usuarios;
CREATE POLICY usuarios_update_empresa ON public.usuarios
  FOR UPDATE
  TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_master() OR is_admin()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND (is_master() OR is_admin()));
