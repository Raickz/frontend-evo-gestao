-- Migration: 20260928030000_rodada_andrade_4b_lotes_painel_relatorios.sql
-- Rodada Andrade 4B: Lote e Validade de Componentes, FEFO na Montagem,
-- Alertas de Validade, RPCs de Painel da Distribuidora e Relatórios Especializados.

-- ============================================================================
-- 1. TABELA DE LOTES DE COMPONENTES / PRODUTOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  numero_lote text NOT NULL,
  data_validade date,
  quantidade numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lotes_empresa_produto_lote UNIQUE (empresa_id, produto_id, numero_lote)
);

CREATE INDEX IF NOT EXISTS idx_lotes_empresa_produto ON public.lotes(empresa_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_validade ON public.lotes(empresa_id, data_validade);

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_select_empresa" ON public.lotes;
CREATE POLICY "lotes_select_empresa" ON public.lotes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "lotes_insert_empresa" ON public.lotes;
CREATE POLICY "lotes_insert_empresa" ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_operador_or_above()
  );

DROP POLICY IF EXISTS "lotes_update_empresa" ON public.lotes;
CREATE POLICY "lotes_update_empresa" ON public.lotes
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_operador_or_above()
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_operador_or_above()
  );

DROP POLICY IF EXISTS "lotes_delete_empresa" ON public.lotes;
CREATE POLICY "lotes_delete_empresa" ON public.lotes
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_manager_or_above()
  );

-- ============================================================================
-- 2. CAMPOS DE LOTE EM ITENS_COMPRA E MOVIMENTACOES_ESTOQUE
-- ============================================================================
ALTER TABLE public.itens_compra ADD COLUMN IF NOT EXISTS numero_lote text;
ALTER TABLE public.itens_compra ADD COLUMN IF NOT EXISTS data_validade date;

ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS numero_lote text;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS data_validade date;

-- ============================================================================
-- 3. RPC: criar_compra COM SUPORTE A LOTE E VALIDADE NOS ITENS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.criar_compra(
  p_fornecedor_id uuid,
  p_itens jsonb,
  p_observacoes text DEFAULT ''::text,
  p_data_compra date DEFAULT CURRENT_DATE,
  p_forma_pagamento text DEFAULT 'a_prazo'::text,
  p_vencimento date DEFAULT NULL::date,
  p_valor_pago numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_usuario_id uuid;
  v_empresa_id uuid;
  v_compra_id uuid;
  v_total numeric := 0;
  v_numero bigint;
  v_item jsonb;
  v_subtotal numeric;
  v_novo_item_id uuid;
  v_status_ass jsonb;
  v_num_lote text;
  v_dt_val date;
BEGIN
  -- 0. Validar status da assinatura
  v_status_ass := public.get_status_assinatura();
  IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', COALESCE(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.')
    );
  END IF;

  -- 1. Autenticação e Empresa
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não autenticado.');
  END IF;

  SELECT u.id, u.empresa_id INTO v_usuario_id, v_empresa_id
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true;

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou não possui perfil cadastrado.');
  END IF;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não possui empresa vinculada ou ela se encontra inativa/bloqueada.');
  END IF;

  -- 2. Permissão
  IF NOT public.is_operador_or_above() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Permissão negada. Você não possui perfil autorizado para criar compras.');
  END IF;

  -- 3. Validar fornecedor
  IF NOT EXISTS (
    SELECT 1 FROM public.fornecedores f
    WHERE f.id = p_fornecedor_id AND f.empresa_id = v_empresa_id AND f.ativo = true
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Fornecedor inválido ou pertence a outra empresa.');
  END IF;

  -- 4. Validar itens
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A compra deve conter pelo menos um item.');
  END IF;

  -- 5. Lock transacional por empresa e cálculo do próximo número
  PERFORM pg_advisory_xact_lock(hashtext('empresa_compra_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.compras
  WHERE empresa_id = v_empresa_id;

  -- 6. Inserir cabeçalho (rascunho) com OVERRIDING SYSTEM VALUE
  INSERT INTO public.compras (
    empresa_id,
    fornecedor_id,
    numero,
    total,
    status,
    observacoes,
    data_compra,
    forma_pagamento,
    vencimento,
    valor_pago,
    created_by
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id,
    p_fornecedor_id,
    v_numero,
    0,
    'rascunho',
    p_observacoes,
    p_data_compra,
    p_forma_pagamento,
    p_vencimento,
    p_valor_pago,
    v_usuario_id
  )
  RETURNING id INTO v_compra_id;

  -- 7. Inserir itens e calcular total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = (v_item->>'produto_id')::uuid
        AND p.empresa_id = v_empresa_id
        AND p.ativo = true
    ) THEN
      RAISE EXCEPTION 'Produto inválido ou pertence a outra empresa: %', v_item->>'produto_id';
    END IF;

    IF ((v_item->>'quantidade')::numeric) <= 0 THEN
      RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
    END IF;

    IF ((v_item->>'preco_unitario')::numeric) < 0 THEN
      RAISE EXCEPTION 'O preço unitário não pode ser negativo.';
    END IF;

    v_subtotal := ROUND(((v_item->>'quantidade')::numeric * (v_item->>'preco_unitario')::numeric), 2);
    v_num_lote := NULLIF(trim(COALESCE(v_item->>'numero_lote', '')), '');
    v_dt_val := NULL;
    IF v_item->>'data_validade' IS NOT NULL AND trim(v_item->>'data_validade') <> '' THEN
      v_dt_val := (v_item->>'data_validade')::date;
    END IF;

    INSERT INTO public.itens_compra (
      empresa_id,
      compra_id,
      produto_id,
      quantidade,
      preco_unitario,
      subtotal,
      numero_lote,
      data_validade
    )
    VALUES (
      v_empresa_id,
      v_compra_id,
      (v_item->>'produto_id')::uuid,
      (v_item->>'quantidade')::numeric,
      (v_item->>'preco_unitario')::numeric,
      v_subtotal,
      v_num_lote,
      v_dt_val
    )
    RETURNING id INTO v_novo_item_id;

    v_total := v_total + v_subtotal;
  END LOOP;

  -- 8. Atualizar total
  UPDATE public.compras SET total = v_total WHERE id = v_compra_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'compra_id', v_compra_id,
    'numero', v_numero,
    'total', v_total,
    'status', 'rascunho'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.criar_compra(uuid, jsonb, text, date, text, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_compra(uuid, jsonb, text, date, text, date, numeric) TO authenticated, service_role;

-- ============================================================================
-- 4. RPC: confirmar_compra COM GERAÇÃO E ATUALIZAÇÃO DE SALDO POR LOTE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirmar_compra(
  p_compra_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usuario_id uuid;
  v_empresa_id uuid;
  v_compra record;
  v_item record;
  v_estoque record;
  v_mov_id uuid;
  v_lote_id uuid;
  v_conta_pagar_id uuid;
  v_mov_count integer := 0;
  v_status_atual text;
  v_status_ass jsonb;
BEGIN
  -- 0. Validar status da assinatura
  v_status_ass := public.get_status_assinatura();
  IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', COALESCE(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.')
    );
  END IF;

  -- 1. Autenticação
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não autenticado.');
  END IF;

  SELECT u.id, u.empresa_id INTO v_usuario_id, v_empresa_id
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true;

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou não possui perfil cadastrado.');
  END IF;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não possui empresa vinculada.');
  END IF;

  -- 2. Permissão
  IF NOT public.is_operador_or_above() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Permissão negada.');
  END IF;

  -- 3. Buscar compra
  SELECT * INTO v_compra FROM public.compras WHERE id = p_compra_id AND empresa_id = v_empresa_id;

  IF v_compra.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Compra não encontrada.');
  END IF;

  IF v_compra.status != 'rascunho' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas compras em rascunho podem ser confirmadas. Status atual: ' || v_compra.status);
  END IF;

  -- 4. Processar cada item
  FOR v_item IN
    SELECT ic.*, p.nome AS produto_nome, p.unidade
    FROM public.itens_compra ic
    JOIN public.produtos p ON p.id = ic.produto_id
    WHERE ic.compra_id = p_compra_id
  LOOP
    SELECT * INTO v_estoque FROM public.estoques
    WHERE produto_id = v_item.produto_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_estoque.id IS NULL THEN
      INSERT INTO public.estoques (empresa_id, produto_id, quantidade)
      VALUES (v_empresa_id, v_item.produto_id, v_item.quantidade);
    ELSE
      UPDATE public.estoques SET quantidade = quantidade + v_item.quantidade, updated_at = now()
      WHERE id = v_estoque.id;
    END IF;

    -- Gerenciamento de Lote se informado
    v_lote_id := NULL;
    IF v_item.numero_lote IS NOT NULL AND trim(v_item.numero_lote) <> '' THEN
      SELECT id INTO v_lote_id
      FROM public.lotes
      WHERE empresa_id = v_empresa_id
        AND produto_id = v_item.produto_id
        AND numero_lote = trim(v_item.numero_lote)
      FOR UPDATE;

      IF v_lote_id IS NOT NULL THEN
        UPDATE public.lotes
        SET quantidade = quantidade + v_item.quantidade,
            data_validade = COALESCE(v_item.data_validade, data_validade),
            updated_at = now()
        WHERE id = v_lote_id;
      ELSE
        INSERT INTO public.lotes (
          empresa_id,
          produto_id,
          numero_lote,
          data_validade,
          quantidade
        ) VALUES (
          v_empresa_id,
          v_item.produto_id,
          trim(v_item.numero_lote),
          v_item.data_validade,
          v_item.quantidade
        )
        RETURNING id INTO v_lote_id;
      END IF;
    END IF;

    INSERT INTO public.movimentacoes_estoque (
      empresa_id, produto_id, fornecedor_id, tipo, quantidade, motivo, referencia_id,
      usuario_id, lote_id, numero_lote, data_validade, created_at
    ) VALUES (
      v_empresa_id, v_item.produto_id, v_compra.fornecedor_id, 'entrada',
      v_item.quantidade,
      'Compra #' || v_compra.numero || ' confirmada' || COALESCE(' (Lote: ' || v_item.numero_lote || ')', ''),
      p_compra_id, v_usuario_id, v_lote_id, v_item.numero_lote, v_item.data_validade, now()
    );

    v_mov_count := v_mov_count + 1;

    UPDATE public.produtos SET preco_custo = v_item.preco_unitario, updated_at = now()
    WHERE id = v_item.produto_id;
  END LOOP;

  -- 5. Criar conta a pagar (se a prazo ou valor_pago < total)
  IF v_compra.forma_pagamento = 'a_prazo' AND v_compra.valor_pago < v_compra.total THEN
    INSERT INTO public.contas_pagar (
      empresa_id, fornecedor_id, descricao, valor, vencimento, valor_pago, status
    ) VALUES (
      v_empresa_id, v_compra.fornecedor_id,
      'Compra #' || v_compra.numero,
      v_compra.total,
      COALESCE(v_compra.vencimento, (CURRENT_DATE + INTERVAL '30 days')::date),
      COALESCE(v_compra.valor_pago, 0),
      'pendente'
    )
    RETURNING id INTO v_conta_pagar_id;
  END IF;

  -- 6. Atualizar status da compra
  UPDATE public.compras SET status = 'confirmada', updated_at = now() WHERE id = p_compra_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'compra_id', p_compra_id,
    'numero', v_compra.numero,
    'movimentacoes_criadas', v_mov_count,
    'conta_pagar_id', v_conta_pagar_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirmar_compra(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_compra(uuid) TO authenticated, service_role;

-- ============================================================================
-- 5. RPC: registrar_entrada_estoque COM SUPORTE A LOTE E VALIDADE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(
    p_produto_id uuid,
    p_quantidade numeric,
    p_motivo text DEFAULT 'Entrada de estoque'::text,
    p_numero_lote text DEFAULT NULL::text,
    p_data_validade date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_status_ass jsonb;
    v_lote_id uuid := NULL;
    v_num_lote text;
BEGIN
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    END IF;

    SELECT id, empresa_id INTO v_usuario_id, v_empresa_id
    FROM public.usuarios
    WHERE auth_user_id = auth.uid() AND ativo = true
    LIMIT 1;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não possui uma empresa válida.';
    END IF;

    IF NOT (
        public.is_admin()
        OR public.is_manager_or_above()
        OR public.is_operador_or_above()
    ) THEN
        RAISE EXCEPTION 'Usuário não possui permissão para movimentar estoque.';
    END IF;

    IF p_quantidade <= 0 THEN
        RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.produtos
        WHERE id = p_produto_id AND empresa_id = v_empresa_id AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Produto inválido ou pertence a outra empresa.';
    END IF;

    UPDATE public.estoques
    SET quantidade = quantidade + p_quantidade, updated_at = now()
    WHERE produto_id = p_produto_id AND empresa_id = v_empresa_id;

    IF NOT FOUND THEN
        INSERT INTO public.estoques (empresa_id, produto_id, quantidade)
        VALUES (v_empresa_id, p_produto_id, p_quantidade);
    END IF;

    -- Gerenciar lote
    v_num_lote := NULLIF(trim(COALESCE(p_numero_lote, '')), '');
    IF v_num_lote IS NOT NULL THEN
      SELECT id INTO v_lote_id
      FROM public.lotes
      WHERE empresa_id = v_empresa_id
        AND produto_id = p_produto_id
        AND numero_lote = v_num_lote
      FOR UPDATE;

      IF v_lote_id IS NOT NULL THEN
        UPDATE public.lotes
        SET quantidade = quantidade + p_quantidade,
            data_validade = COALESCE(p_data_validade, data_validade),
            updated_at = now()
        WHERE id = v_lote_id;
      ELSE
        INSERT INTO public.lotes (
          empresa_id,
          produto_id,
          numero_lote,
          data_validade,
          quantidade
        ) VALUES (
          v_empresa_id,
          p_produto_id,
          v_num_lote,
          p_data_validade,
          p_quantidade
        )
        RETURNING id INTO v_lote_id;
      END IF;
    END IF;

    INSERT INTO public.movimentacoes_estoque (
        empresa_id, produto_id, tipo, quantidade, motivo, usuario_id,
        lote_id, numero_lote, data_validade
    )
    VALUES (
        v_empresa_id, p_produto_id, 'entrada', p_quantidade,
        p_motivo || COALESCE(' (Lote: ' || v_num_lote || ')', ''),
        v_usuario_id, v_lote_id, v_num_lote, p_data_validade
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'produto_id', p_produto_id,
        'quantidade_adicionada', p_quantidade,
        'lote_id', v_lote_id
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_entrada_estoque(uuid, numeric, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_estoque(uuid, numeric, text, text, date) TO authenticated, service_role;

-- ============================================================================
-- 6. RPC: finalizar_montagem_cestas COM BLOQUEIO DE LOTE VENCIDO E FEFO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finalizar_montagem_cestas(
  p_ordem_id uuid,
  p_quantidade_produzida numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_ordem record;
  v_qtd_final numeric;
  v_comp_item record;
  v_necessario numeric;
  v_saldo_atual numeric;
  v_custo_unitario_comp numeric;
  v_custo_total_componentes numeric := 0;
  v_custo_adicional numeric := 0;
  v_custo_total_ordem numeric := 0;
  v_custo_unitario_efetivo numeric := 0;
  v_falta_msg text := '';
  v_cesta_estoque_atual numeric := 0;
  v_cesta_custo_anterior numeric := 0;
  v_cesta_novo_custo numeric := 0;
  v_cesta_novo_estoque numeric := 0;

  -- FEFO e Validade
  v_lote_vencido record;
  v_lote_fefo record;
  v_consumir_lote numeric;
  v_falta_consumir_lote numeric;
  v_hoje_sp date;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a uma empresa válida.';
  END IF;

  SELECT id INTO v_usuario_id
  FROM public.usuarios
  WHERE auth_user_id = auth.uid() AND ativo = true
  LIMIT 1;

  -- 1. Validar cargo (master, admin, gerente, operador)
  IF NOT public.is_empresa_operador_or_above() THEN
    RAISE EXCEPTION 'Usuário não possui permissão para finalizar montagem de cestas.';
  END IF;

  -- 2. Validar módulo
  IF NOT public.empresa_tem_modulo('modulo_cestas') THEN
    RAISE EXCEPTION 'O módulo de Cestas e Montagem não está habilitado para esta empresa.';
  END IF;

  -- 3. Travar e validar ordem de montagem (idempotência)
  SELECT
    om.id,
    om.numero,
    om.cesta_produto_id,
    om.composicao_versao_id,
    om.quantidade_planejada,
    om.status,
    p.nome AS cesta_nome,
    p.preco_custo AS cesta_preco_custo,
    cc.custo_adicional
  INTO v_ordem
  FROM public.ordens_montagem om
  JOIN public.produtos p ON p.id = om.cesta_produto_id
  JOIN public.cesta_composicoes cc ON cc.id = om.composicao_versao_id
  WHERE om.id = p_ordem_id AND om.empresa_id = v_empresa_id
  FOR UPDATE OF om;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de montagem não encontrada.';
  END IF;

  IF v_ordem.status = 'concluida' THEN
    RAISE EXCEPTION 'Esta ordem de montagem (#%) já foi finalizada anteriormente.', v_ordem.numero;
  END IF;

  IF v_ordem.status = 'cancelada' THEN
    RAISE EXCEPTION 'Esta ordem de montagem (#%) está cancelada e não pode ser finalizada.', v_ordem.numero;
  END IF;

  v_qtd_final := COALESCE(p_quantidade_produzida, v_ordem.quantidade_planejada);
  IF v_qtd_final <= 0 THEN
    RAISE EXCEPTION 'A quantidade produzida deve ser maior que zero.';
  END IF;

  v_custo_adicional := COALESCE(v_ordem.custo_adicional, 0);
  v_hoje_sp := public.sp_date(now());

  -- 4. Travar estoques de todos os componentes da composição, verificar saldos E LOTES VENCIDOS
  FOR v_comp_item IN
    SELECT
      cci.componente_produto_id,
      cci.quantidade AS qtd_unitaria,
      cci.unidade,
      p.nome AS componente_nome,
      p.preco_custo AS componente_custo
    FROM public.cesta_composicao_itens cci
    JOIN public.produtos p ON p.id = cci.componente_produto_id
    WHERE cci.composicao_id = v_ordem.composicao_versao_id
      AND cci.empresa_id = v_empresa_id
    ORDER BY cci.componente_produto_id
  LOOP
    v_necessario := round(v_comp_item.qtd_unitaria * v_qtd_final, 3);

    -- Travar saldo em estoques
    SELECT COALESCE(quantidade, 0)
    INTO v_saldo_atual
    FROM public.estoques
    WHERE produto_id = v_comp_item.componente_produto_id
      AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_saldo_atual IS NULL OR v_saldo_atual < v_necessario THEN
      v_falta_msg := v_falta_msg || format(
        E'\n• %s: disponível %s %s, necessário %s %s (falta %s %s)',
        v_comp_item.componente_nome,
        COALESCE(v_saldo_atual, 0),
        v_comp_item.unidade,
        v_necessario,
        v_comp_item.unidade,
        v_necessario - COALESCE(v_saldo_atual, 0),
        v_comp_item.unidade
      );
    END IF;

    -- BLOQUEIO DE LOTE VENCIDO: se há lote vencido com saldo > 0 deste componente, bloquear montagem
    SELECT l.numero_lote, l.data_validade, l.quantidade
    INTO v_lote_vencido
    FROM public.lotes l
    WHERE l.empresa_id = v_empresa_id
      AND l.produto_id = v_comp_item.componente_produto_id
      AND l.quantidade > 0
      AND l.data_validade IS NOT NULL
      AND l.data_validade < v_hoje_sp
    ORDER BY l.data_validade ASC
    LIMIT 1;

    IF v_lote_vencido.numero_lote IS NOT NULL THEN
      RAISE EXCEPTION 'Não é possível finalizar a montagem: o componente "%" possui lote vencido ("%", validade: %) com saldo em estoque. Descarte ou regularize o lote antes de montar as cestas.',
        v_comp_item.componente_nome,
        v_lote_vencido.numero_lote,
        to_char(v_lote_vencido.data_validade, 'DD/MM/YYYY');
    END IF;
  END LOOP;

  -- Se faltar qualquer componente no estoque geral, abortar com mensagem clara
  IF v_falta_msg <> '' THEN
    RAISE EXCEPTION 'Estoque insuficiente para montagem da ordem #%:%', v_ordem.numero, v_falta_msg;
  END IF;

  -- 5. Baixar componentes com FEFO nos lotes e gravar movimentações de consumo_montagem
  FOR v_comp_item IN
    SELECT
      cci.componente_produto_id,
      cci.quantidade AS qtd_unitaria,
      cci.unidade,
      p.preco_custo AS componente_custo
    FROM public.cesta_composicao_itens cci
    JOIN public.produtos p ON p.id = cci.componente_produto_id
    WHERE cci.composicao_id = v_ordem.composicao_versao_id
      AND cci.empresa_id = v_empresa_id
    ORDER BY cci.componente_produto_id
  LOOP
    v_necessario := round(v_comp_item.qtd_unitaria * v_qtd_final, 3);
    v_custo_unitario_comp := COALESCE(v_comp_item.componente_custo, 0);
    v_custo_total_componentes := v_custo_total_componentes + (v_necessario * v_custo_unitario_comp);

    -- Atualiza estoque global
    UPDATE public.estoques
    SET quantidade = quantidade - v_necessario,
        updated_at = now()
    WHERE produto_id = v_comp_item.componente_produto_id
      AND empresa_id = v_empresa_id;

    -- Consumir lotes por FEFO (First-Expired, First-Out): lotes com validade mais próxima primeiro
    v_falta_consumir_lote := v_necessario;

    FOR v_lote_fefo IN
      SELECT l.id, l.numero_lote, l.data_validade, l.quantidade
      FROM public.lotes l
      WHERE l.empresa_id = v_empresa_id
        AND l.produto_id = v_comp_item.componente_produto_id
        AND l.quantidade > 0
      ORDER BY (l.data_validade IS NULL) ASC, l.data_validade ASC, l.created_at ASC
      FOR UPDATE
    LOOP
      IF v_falta_consumir_lote <= 0 THEN
        EXIT;
      END IF;

      v_consumir_lote := LEAST(v_lote_fefo.quantidade, v_falta_consumir_lote);

      UPDATE public.lotes
      SET quantidade = quantidade - v_consumir_lote,
          updated_at = now()
      WHERE id = v_lote_fefo.id;

      INSERT INTO public.movimentacoes_estoque (
        empresa_id,
        produto_id,
        tipo,
        quantidade,
        motivo,
        referencia_id,
        usuario_id,
        lote_id,
        numero_lote,
        data_validade
      ) VALUES (
        v_empresa_id,
        v_comp_item.componente_produto_id,
        'consumo_montagem',
        v_consumir_lote,
        format('Consumo FEFO Montagem #%s (%s cestas) - Lote %s', v_ordem.numero, v_qtd_final, v_lote_fefo.numero_lote),
        v_ordem.id,
        v_usuario_id,
        v_lote_fefo.id,
        v_lote_fefo.numero_lote,
        v_lote_fefo.data_validade
      );

      v_falta_consumir_lote := v_falta_consumir_lote - v_consumir_lote;
    END LOOP;

    -- Se sobrou saldo a consumir sem lote (componentes que não estavam registrados por lote)
    IF v_falta_consumir_lote > 0 THEN
      INSERT INTO public.movimentacoes_estoque (
        empresa_id,
        produto_id,
        tipo,
        quantidade,
        motivo,
        referencia_id,
        usuario_id
      ) VALUES (
        v_empresa_id,
        v_comp_item.componente_produto_id,
        'consumo_montagem',
        v_falta_consumir_lote,
        format('Consumo na Montagem #%s (%s cestas) - Sem Lote', v_ordem.numero, v_qtd_final),
        v_ordem.id,
        v_usuario_id
      );
    END IF;
  END LOOP;

  -- Custo efetivo unitário da cesta nesta montagem
  v_custo_total_ordem := v_custo_total_componentes + (v_qtd_final * v_custo_adicional);
  v_custo_unitario_efetivo := round(v_custo_total_ordem / v_qtd_final, 2);

  -- 6. Dar entrada nas cestas prontas e calcular média ponderada de custo
  SELECT COALESCE(quantidade, 0)
  INTO v_cesta_estoque_atual
  FROM public.estoques
  WHERE produto_id = v_ordem.cesta_produto_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.estoques (empresa_id, produto_id, quantidade)
    VALUES (v_empresa_id, v_ordem.cesta_produto_id, v_qtd_final);
    v_cesta_estoque_atual := 0;
  ELSE
    UPDATE public.estoques
    SET quantidade = quantidade + v_qtd_final,
        updated_at = now()
    WHERE produto_id = v_ordem.cesta_produto_id
      AND empresa_id = v_empresa_id;
  END IF;

  v_cesta_novo_estoque := v_cesta_estoque_atual + v_qtd_final;
  v_cesta_custo_anterior := COALESCE(v_ordem.cesta_preco_custo, 0);

  IF v_cesta_novo_estoque > 0 THEN
    v_cesta_novo_custo := round(
      ((v_cesta_estoque_atual * v_cesta_custo_anterior) + (v_qtd_final * v_custo_unitario_efetivo)) / v_cesta_novo_estoque,
      2
    );
  ELSE
    v_cesta_novo_custo := v_custo_unitario_efetivo;
  END IF;

  UPDATE public.produtos
  SET preco_custo = v_cesta_novo_custo,
      updated_at = now()
  WHERE id = v_ordem.cesta_produto_id
    AND empresa_id = v_empresa_id;

  INSERT INTO public.movimentacoes_estoque (
    empresa_id,
    produto_id,
    tipo,
    quantidade,
    motivo,
    referencia_id,
    usuario_id
  ) VALUES (
    v_empresa_id,
    v_ordem.cesta_produto_id,
    'entrada_montagem',
    v_qtd_final,
    format('Entrada por Montagem #%s', v_ordem.numero),
    v_ordem.id,
    v_usuario_id
  );

  -- 7. Atualizar status da ordem
  UPDATE public.ordens_montagem
  SET status = 'concluida',
      quantidade_produzida = v_qtd_final,
      custo_unitario_efetivo = v_custo_unitario_efetivo,
      responsavel_usuario_id = COALESCE(responsavel_usuario_id, v_usuario_id),
      updated_at = now()
  WHERE id = v_ordem.id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'ordem_id', v_ordem.id,
    'numero', v_ordem.numero,
    'quantidade_produzida', v_qtd_final,
    'custo_unitario_efetivo', v_custo_unitario_efetivo,
    'novo_custo_medio_cesta', v_cesta_novo_custo,
    'novo_estoque_cesta', v_cesta_novo_estoque,
    'status', 'concluida'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalizar_montagem_cestas(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_montagem_cestas(uuid, numeric) TO authenticated, service_role;

-- ============================================================================
-- 7. RPC: get_alertas_lotes_componentes (Lotes vencidos e vencendo em 30 dias)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_alertas_lotes_componentes(
  p_dias_antecedencia integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_hoje_sp date;
  v_limite_sp date;
  v_vencidos jsonb := '[]'::jsonb;
  v_vencendo jsonb := '[]'::jsonb;
  v_count_vencidos integer := 0;
  v_count_vencendo integer := 0;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem empresa vinculada.';
  END IF;

  v_hoje_sp := public.sp_date(now());
  v_limite_sp := v_hoje_sp + p_dias_antecedencia;

  -- 1. Lotes Vencidos (saldo > 0 e validade < hoje)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'lote_id', l.id,
        'produto_id', p.id,
        'produto_nome', p.nome,
        'produto_unidade', p.unidade,
        'numero_lote', l.numero_lote,
        'data_validade', l.data_validade,
        'quantidade', l.quantidade,
        'dias_vencido', (v_hoje_sp - l.data_validade)
      ) ORDER BY l.data_validade ASC
    ), '[]'::jsonb),
    COUNT(*)
  INTO v_vencidos, v_count_vencidos
  FROM public.lotes l
  JOIN public.produtos p ON p.id = l.produto_id
  WHERE l.empresa_id = v_empresa_id
    AND l.quantidade > 0
    AND l.data_validade IS NOT NULL
    AND l.data_validade < v_hoje_sp;

  -- 2. Lotes Vencendo em até p_dias_antecedencia (saldo > 0 e hoje <= validade <= limite)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'lote_id', l.id,
        'produto_id', p.id,
        'produto_nome', p.nome,
        'produto_unidade', p.unidade,
        'numero_lote', l.numero_lote,
        'data_validade', l.data_validade,
        'quantidade', l.quantidade,
        'dias_para_vencer', (l.data_validade - v_hoje_sp)
      ) ORDER BY l.data_validade ASC
    ), '[]'::jsonb),
    COUNT(*)
  INTO v_vencendo, v_count_vencendo
  FROM public.lotes l
  JOIN public.produtos p ON p.id = l.produto_id
  WHERE l.empresa_id = v_empresa_id
    AND l.quantidade > 0
    AND l.data_validade IS NOT NULL
    AND l.data_validade >= v_hoje_sp
    AND l.data_validade <= v_limite_sp;

  RETURN jsonb_build_object(
    'vencidos', v_vencidos,
    'total_vencidos', v_count_vencidos,
    'vencendo', v_vencendo,
    'total_vencendo', v_count_vencendo,
    'hoje', v_hoje_sp
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_alertas_lotes_componentes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_alertas_lotes_componentes(integer) TO authenticated, service_role;

-- ============================================================================
-- 8. RPC: get_relatorio_inadimplencia_faixas (A vencer, 1–30, 31–60, 61–90, +90)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_inadimplencia_faixas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_hoje_sp date;
  v_resultado jsonb;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem empresa vinculada.';
  END IF;

  v_hoje_sp := public.sp_date(now());

  WITH titulos_abertos AS (
    SELECT
      cr.id,
      cr.cliente_id,
      c.nome AS cliente_nome,
      c.telefone AS cliente_telefone,
      c.documento AS cliente_documento,
      cr.descricao,
      cr.vencimento,
      cr.valor,
      cr.valor_pago,
      (cr.valor - cr.valor_pago) AS saldo_aberto,
      (v_hoje_sp - cr.vencimento) AS dias_atraso,
      CASE
        WHEN cr.vencimento >= v_hoje_sp THEN 'a_vencer'
        WHEN (v_hoje_sp - cr.vencimento) BETWEEN 1 AND 30 THEN '1_30'
        WHEN (v_hoje_sp - cr.vencimento) BETWEEN 31 AND 60 THEN '31_60'
        WHEN (v_hoje_sp - cr.vencimento) BETWEEN 61 AND 90 THEN '61_90'
        ELSE 'mais_90'
      END AS faixa
    FROM public.contas_receber cr
    LEFT JOIN public.clientes c ON c.id = cr.cliente_id
    WHERE cr.empresa_id = v_empresa_id
      AND cr.status IN ('pendente', 'atrasado')
      AND (cr.valor - cr.valor_pago) > 0
  )
  SELECT jsonb_build_object(
    'a_vencer', jsonb_build_object(
      'total', COALESCE(SUM(saldo_aberto) FILTER (WHERE faixa = 'a_vencer'), 0),
      'clientes_count', COUNT(DISTINCT cliente_id) FILTER (WHERE faixa = 'a_vencer'),
      'titulos_count', COUNT(*) FILTER (WHERE faixa = 'a_vencer')
    ),
    'dias_1_30', jsonb_build_object(
      'total', COALESCE(SUM(saldo_aberto) FILTER (WHERE faixa = '1_30'), 0),
      'clientes_count', COUNT(DISTINCT cliente_id) FILTER (WHERE faixa = '1_30'),
      'titulos_count', COUNT(*) FILTER (WHERE faixa = '1_30')
    ),
    'dias_31_60', jsonb_build_object(
      'total', COALESCE(SUM(saldo_aberto) FILTER (WHERE faixa = '31_60'), 0),
      'clientes_count', COUNT(DISTINCT cliente_id) FILTER (WHERE faixa = '31_60'),
      'titulos_count', COUNT(*) FILTER (WHERE faixa = '31_60')
    ),
    'dias_61_90', jsonb_build_object(
      'total', COALESCE(SUM(saldo_aberto) FILTER (WHERE faixa = '61_90'), 0),
      'clientes_count', COUNT(DISTINCT cliente_id) FILTER (WHERE faixa = '61_90'),
      'titulos_count', COUNT(*) FILTER (WHERE faixa = '61_90')
    ),
    'mais_90', jsonb_build_object(
      'total', COALESCE(SUM(saldo_aberto) FILTER (WHERE faixa = 'mais_90'), 0),
      'clientes_count', COUNT(DISTINCT cliente_id) FILTER (WHERE faixa = 'mais_90'),
      'titulos_count', COUNT(*) FILTER (WHERE faixa = 'mais_90')
    ),
    'total_vencido', COALESCE(SUM(saldo_aberto) FILTER (WHERE faixa <> 'a_vencer'), 0),
    'clientes_inadimplentes_count', COUNT(DISTINCT cliente_id) FILTER (WHERE faixa <> 'a_vencer'),
    'total_geral_receber', COALESCE(SUM(saldo_aberto), 0)
  )
  INTO v_resultado
  FROM titulos_abertos;

  RETURN v_resultado;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_relatorio_inadimplencia_faixas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_relatorio_inadimplencia_faixas() TO authenticated, service_role;
