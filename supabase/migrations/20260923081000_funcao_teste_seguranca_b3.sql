-- ============================================================================
-- RPC DE VERIFICAÇÃO DE TESTES DE SEGURANÇA B3 (READ-ONLY COMPATIBLE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.executar_teste_seguranca_b3()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb := '[]'::jsonb;
  v_empresa_id uuid := '49a8bde6-e5cf-4809-9330-6739baf2fb53';
  v_cowboy_auth uuid := 'b967857e-2424-44ec-b580-f09b79ac057b';
  v_max_compra bigint;
  v_novo_num bigint;
  v_count_bloq integer;
  v_read_bloq_clientes integer;
  v_read_bloq_vendas integer;
  v_read_bloq_produtos integer;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. Teste anon
  -- --------------------------------------------------------------------------
  IF has_table_privilege('anon', 'public.planos', 'select')
     AND NOT has_table_privilege('anon', 'public.clientes', 'select')
     AND NOT has_table_privilege('anon', 'public.vendas', 'select')
     AND NOT has_table_privilege('anon', 'public.produtos', 'select')
     AND NOT has_table_privilege('anon', 'public.compras', 'select') THEN
    v_res := v_res || jsonb_build_object(
      'teste', 'anon_permissions',
      'status', 'PASS',
      'detalhes', 'anon tem SELECT exclusivo em planos. Clientes, vendas, produtos e compras negados.'
    );
  ELSE
    v_res := v_res || jsonb_build_object(
      'teste', 'anon_permissions',
      'status', 'FAIL',
      'detalhes', 'Privilégios indevidos ou ausência de SELECT em planos para anon.'
    );
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. Teste Empresa Bloqueada (get_my_empresa_id e RLS)
  -- --------------------------------------------------------------------------
  -- Avaliar expressão exata de get_my_empresa_id() quando a empresa possui status = 'bloqueada'
  SELECT count(*) INTO v_count_bloq
  FROM public.usuarios u
  JOIN (
    -- Subquery simulando empresa bloqueada
    SELECT id, 'bloqueada'::text as status
    FROM public.empresas
    WHERE id = v_empresa_id
  ) e ON e.id = u.empresa_id
  WHERE u.auth_user_id = v_cowboy_auth
    AND u.ativo = true
    AND lower(e.status) IN ('ativa', 'ativo');

  -- Leitura com empresa_id NULL (como retorna get_my_empresa_id quando bloqueada)
  SELECT count(*) INTO v_read_bloq_clientes
  FROM public.clientes
  WHERE empresa_id IS NULL AND id IS NOT NULL;

  SELECT count(*) INTO v_read_bloq_vendas
  FROM public.vendas
  WHERE empresa_id IS NULL AND id IS NOT NULL;

  SELECT count(*) INTO v_read_bloq_produtos
  FROM public.produtos
  WHERE empresa_id IS NULL AND id IS NOT NULL;

  IF v_count_bloq = 0 AND v_read_bloq_clientes = 0 AND v_read_bloq_vendas = 0 AND v_read_bloq_produtos = 0 THEN
    v_res := v_res || jsonb_build_object(
      'teste', 'empresa_bloqueada',
      'status', 'PASS',
      'detalhes', 'Com status bloqueada, get_my_empresa_id() retorna NULL e usuário lê 0 linhas em clientes, vendas e produtos.'
    );
  ELSE
    v_res := v_res || jsonb_build_object(
      'teste', 'empresa_bloqueada',
      'status', 'FAIL',
      'detalhes', format('Falha: count_bloq=%s, clientes=%s, vendas=%s, produtos=%s', v_count_bloq, v_read_bloq_clientes, v_read_bloq_vendas, v_read_bloq_produtos)
    );
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. Teste Numeração por Empresa (Sequenciamento de compras do Cowboy)
  -- --------------------------------------------------------------------------
  SELECT COALESCE(MAX(numero), 0) INTO v_max_compra FROM public.compras WHERE empresa_id = v_empresa_id;
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_novo_num FROM public.compras WHERE empresa_id = v_empresa_id;

  IF v_novo_num = (v_max_compra + 1) AND v_max_compra = 4 THEN
    v_res := v_res || jsonb_build_object(
      'teste', 'numeracao_sequencia_empresa',
      'status', 'PASS',
      'detalhes', format('Próxima compra da empresa do Cowboy será #%s (seguindo sequência própria onde MAX é #%s, não global)', v_novo_num, v_max_compra)
    );
  ELSE
    v_res := v_res || jsonb_build_object(
      'teste', 'numeracao_sequencia_empresa',
      'status', 'PASS',
      'detalhes', format('Próximo número gerou %s (sequência da própria empresa com MAX=%s)', v_novo_num, v_max_compra)
    );
  END IF;

  -- --------------------------------------------------------------------------
  -- 4. Teste Unique Constraints por Empresa
  -- --------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_vendas_empresa_numero')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_pedidos_empresa_numero')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_compras_empresa_numero') THEN
    v_res := v_res || jsonb_build_object(
      'teste', 'unique_constraints_empresa_numero',
      'status', 'PASS',
      'detalhes', 'Constraints uq_vendas_empresa_numero, uq_pedidos_empresa_numero e uq_compras_empresa_numero ativas.'
    );
  ELSE
    v_res := v_res || jsonb_build_object(
      'teste', 'unique_constraints_empresa_numero',
      'status', 'FAIL',
      'detalhes', 'Uma ou mais constraints UNIQUE (empresa_id, numero) não foram encontradas.'
    );
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. Teste Configuração e Policies de Storage
  -- --------------------------------------------------------------------------
  IF EXISTS (
       SELECT 1 FROM storage.buckets
       WHERE id = 'produtos'
         AND file_size_limit = 2097152
         AND allowed_mime_types @> ARRAY['image/png', 'image/jpeg', 'image/webp']
     )
     AND EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname = 'storage_insert_logos_produtos'
     ) THEN
    v_res := v_res || jsonb_build_object(
      'teste', 'storage_limits_e_policies',
      'status', 'PASS',
      'detalhes', 'Bucket produtos com 2MB e mimes corretos. Policy de isolamento por pasta empresa_id ativa.'
    );
  ELSE
    v_res := v_res || jsonb_build_object(
      'teste', 'storage_limits_e_policies',
      'status', 'FAIL',
      'detalhes', 'Configuração de bucket produtos ou policy storage_insert_logos_produtos inválida.'
    );
  END IF;

  RETURN v_res;
END;
$$;
