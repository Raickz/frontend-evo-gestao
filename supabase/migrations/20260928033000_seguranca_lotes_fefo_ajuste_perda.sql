-- Migration: 20260928033000_seguranca_lotes_fefo_ajuste_perda.sql
-- Rodada Andrade 4B:
-- 1. Remoção de políticas de INSERT/UPDATE/DELETE direto na tabela lotes para authenticated.
--    Toda escrita de lotes passa a ser EXCLUSIVAMENTE via RPCs SECURITY DEFINER.
-- 2. Atualização de ajustar_estoque_manual para suportar lote_id e baixar lote vencido como perda
--    com motivo obrigatório, atualizando de forma atômica saldo do lote, estoque total e gerando auditoria/movimentação.
-- 3. Atualização de finalizar_montagem_cestas:
--    A montagem só BLOQUEIA se não houver saldo suficiente em lotes VÁLIDOS (+ componentes sem lote).
--    Se houver lote vencido mas saldo válido suficiente, consome apenas os válidos via FEFO e retorna
--    aviso explicativo sobre o lote vencido no JSON de retorno (sem travar a produção).

-- ============================================================================
-- 1. HARDENING DE POLICIES NA TABELA LOTES
-- ============================================================================
-- Manter SELECT para usuários autenticados da empresa
DROP POLICY IF EXISTS "lotes_select_empresa" ON public.lotes;
CREATE POLICY "lotes_select_empresa" ON public.lotes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- Remover estritamente quaisquer políticas de escrita direta (INSERT/UPDATE/DELETE) para authenticated
DROP POLICY IF EXISTS "lotes_insert_empresa" ON public.lotes;
DROP POLICY IF EXISTS "lotes_update_empresa" ON public.lotes;
DROP POLICY IF EXISTS "lotes_delete_empresa" ON public.lotes;

-- Garantir que anon e public não tenham permissões de escrita direta
REVOKE INSERT, UPDATE, DELETE ON TABLE public.lotes FROM PUBLIC, anon;

-- ============================================================================
-- 2. RPC: ajustar_estoque_manual COM SUPORTE A LOTE E BAIXA DE PERDA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ajustar_estoque_manual(
    p_produto_id uuid,
    p_tipo text,
    p_quantidade numeric,
    p_motivo text,
    p_lote_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_estoque record;
    v_lote record;
    v_novo_saldo numeric;
    v_novo_saldo_lote numeric := NULL;
    v_tipo_norm text;
    v_status_ass jsonb;
    v_mov_id uuid;
BEGIN
    -- 0. Validar assinatura
    v_status_ass := public.get_status_assinatura();
    IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Acesso bloqueado por pendência na assinatura.');
    END IF;

    -- 1. Identificar empresa e usuário
    v_empresa_id := public.get_my_empresa_id();
    v_usuario_id := public.get_my_usuario_id();

    IF v_empresa_id IS NULL OR v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
    END IF;

    -- 2. Ajuste manual requer perfil gerente ou superior
    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem realizar ajustes manuais de estoque.';
    END IF;

    v_tipo_norm := lower(trim(p_tipo));
    IF v_tipo_norm NOT IN ('entrada', 'saida', 'ajuste', 'perda') THEN
        RAISE EXCEPTION 'Tipo de movimentação inválido. Permitidos: entrada, saida, ajuste, perda.';
    END IF;

    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
        RAISE EXCEPTION 'A quantidade informada para o ajuste deve ser maior que zero.';
    END IF;

    IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
        RAISE EXCEPTION 'O motivo do ajuste de estoque é obrigatório (mínimo de 3 caracteres).';
    END IF;

    -- 3. Validar produto da empresa
    IF NOT EXISTS (
        SELECT 1 FROM public.produtos
        WHERE id = p_produto_id AND empresa_id = v_empresa_id AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Produto não encontrado ou inativo nesta empresa.';
    END IF;

    -- 4. Se lote_id foi informado, validar e travar lote
    IF p_lote_id IS NOT NULL THEN
        SELECT * INTO v_lote
        FROM public.lotes
        WHERE id = p_lote_id AND empresa_id = v_empresa_id AND produto_id = p_produto_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Lote informado não foi encontrado ou não pertence a este produto nesta empresa.';
        END IF;

        IF v_tipo_norm IN ('saida', 'perda') AND v_lote.quantidade < p_quantidade THEN
            RAISE EXCEPTION 'Saldo insuficiente no lote "%": disponível % %, solicitado % %.',
                v_lote.numero_lote, v_lote.quantidade, '', p_quantidade, '';
        END IF;
    END IF;

    -- 5. Travar linha do estoque total do produto
    SELECT * INTO v_estoque
    FROM public.estoques
    WHERE produto_id = p_produto_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_estoque.id IS NULL THEN
        IF v_tipo_norm IN ('saida', 'perda') THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto: saldo disponível 0, solicitado %.', p_quantidade;
        END IF;

        v_novo_saldo := p_quantidade;
        INSERT INTO public.estoques (empresa_id, produto_id, quantidade, updated_at)
        VALUES (v_empresa_id, p_produto_id, v_novo_saldo, now());
    ELSE
        IF v_tipo_norm = 'entrada' THEN
            v_novo_saldo := v_estoque.quantidade + p_quantidade;
        ELSIF v_tipo_norm IN ('saida', 'perda') THEN
            IF v_estoque.quantidade < p_quantidade THEN
                RAISE EXCEPTION 'Estoque insuficiente para o produto: saldo total disponível %, solicitado %.',
                    v_estoque.quantidade, p_quantidade;
            END IF;
            v_novo_saldo := v_estoque.quantidade - p_quantidade;
        ELSE -- 'ajuste' (define saldo absoluto)
            v_novo_saldo := p_quantidade;
        END IF;

        UPDATE public.estoques
        SET quantidade = v_novo_saldo, updated_at = now()
        WHERE id = v_estoque.id;
    END IF;

    -- 6. Atualizar saldo do lote se lote_id informado
    IF p_lote_id IS NOT NULL THEN
        IF v_tipo_norm = 'entrada' THEN
            v_novo_saldo_lote := v_lote.quantidade + p_quantidade;
        ELSIF v_tipo_norm IN ('saida', 'perda') THEN
            v_novo_saldo_lote := v_lote.quantidade - p_quantidade;
        ELSE -- 'ajuste'
            v_novo_saldo_lote := p_quantidade;
        END IF;

        UPDATE public.lotes
        SET quantidade = v_novo_saldo_lote,
            updated_at = now()
        WHERE id = v_lote.id;
    END IF;

    -- 7. Registrar auditoria em movimentacoes_estoque
    INSERT INTO public.movimentacoes_estoque (
        empresa_id,
        produto_id,
        tipo,
        quantidade,
        motivo,
        usuario_id,
        lote_id,
        numero_lote,
        data_validade,
        created_at
    )
    VALUES (
        v_empresa_id,
        p_produto_id,
        v_tipo_norm,
        p_quantidade,
        trim(p_motivo) || CASE
            WHEN v_tipo_norm = 'perda' AND v_lote.numero_lote IS NOT NULL THEN
                ' [Perda/Descarte Lote: ' || v_lote.numero_lote || ']'
            WHEN v_lote.numero_lote IS NOT NULL THEN
                ' [Lote: ' || v_lote.numero_lote || ']'
            ELSE ''
        END,
        v_usuario_id,
        v_lote.id,
        v_lote.numero_lote,
        v_lote.data_validade,
        now()
    )
    RETURNING id INTO v_mov_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'produto_id', p_produto_id,
        'tipo', v_tipo_norm,
        'quantidade', p_quantidade,
        'novo_saldo', v_novo_saldo,
        'lote_id', v_lote.id,
        'novo_saldo_lote', v_novo_saldo_lote,
        'movimentacao_id', v_mov_id
    );
END;
$$;

-- Permissões na RPC ajustar_estoque_manual
REVOKE EXECUTE ON FUNCTION public.ajustar_estoque_manual(uuid, text, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_estoque_manual(uuid, text, numeric, text, uuid) TO authenticated, service_role;

-- ============================================================================
-- 3. RPC: finalizar_montagem_cestas ATUALIZADA
--    - Bloqueia APENAS quando não houver saldo suficiente em lotes válidos (+ sem lote)
--    - Consome válidos por FEFO
--    - Se existir lote vencido com saldo mas houver válidos suficientes, executa a montagem e AVISA
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
  v_saldo_valido_lotes numeric;
  v_saldo_sem_lote numeric;
  v_saldo_valido_total numeric;
  v_custo_unitario_comp numeric;
  v_custo_total_componentes numeric := 0;
  v_custo_adicional numeric := 0;
  v_custo_total_ordem numeric := 0;
  v_custo_unitario_efetivo numeric := 0;
  v_falta_msg text := '';
  v_avisos text[] := ARRAY[]::text[];
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

  -- 4. Travar estoques de todos os componentes e verificar saldos válidos
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
        E'\n• %s: estoque total disponível %s %s, necessário %s %s (falta %s %s)',
        v_comp_item.componente_nome,
        COALESCE(v_saldo_atual, 0),
        v_comp_item.unidade,
        v_necessario,
        v_comp_item.unidade,
        v_necessario - COALESCE(v_saldo_atual, 0),
        v_comp_item.unidade
      );
    END IF;

    -- Verificar lotes válidos vs lotes vencidos
    -- Saldo em lotes NÃO vencidos (data_validade >= hoje OU sem validade cadastrada)
    SELECT COALESCE(SUM(l.quantidade), 0)
    INTO v_saldo_valido_lotes
    FROM public.lotes l
    WHERE l.empresa_id = v_empresa_id
      AND l.produto_id = v_comp_item.componente_produto_id
      AND l.quantidade > 0
      AND (l.data_validade IS NULL OR l.data_validade >= v_hoje_sp);

    -- Saldo do estoque que não está rastreado em lotes
    -- (se o estoque total for maior que a soma de todos os lotes cadastrados)
    SELECT GREATEST(0, COALESCE(v_saldo_atual, 0) - COALESCE(SUM(l.quantidade), 0))
    INTO v_saldo_sem_lote
    FROM public.lotes l
    WHERE l.empresa_id = v_empresa_id
      AND l.produto_id = v_comp_item.componente_produto_id
      AND l.quantidade > 0;

    v_saldo_valido_total := v_saldo_valido_lotes + v_saldo_sem_lote;

    -- Se o saldo VÁLIDO total for insuficiente para a montagem, BLOQUEAR
    IF v_saldo_valido_total < v_necessario THEN
      v_falta_msg := v_falta_msg || format(
        E'\n• %s: saldo VÁLIDO suficiente não encontrado (válido em lotes/geral: %s %s, necessário: %s %s). Regularize os lotes vencidos.',
        v_comp_item.componente_nome,
        v_saldo_valido_total,
        v_comp_item.unidade,
        v_necessario,
        v_comp_item.unidade
      );
    END IF;

    -- Se há lote vencido com saldo, coletar aviso explicativo (sem bloquear se houver saldo válido)
    FOR v_lote_vencido IN
      SELECT l.numero_lote, l.data_validade, l.quantidade
      FROM public.lotes l
      WHERE l.empresa_id = v_empresa_id
        AND l.produto_id = v_comp_item.componente_produto_id
        AND l.quantidade > 0
        AND l.data_validade IS NOT NULL
        AND l.data_validade < v_hoje_sp
      ORDER BY l.data_validade ASC
    LOOP
      v_avisos := array_append(
        v_avisos,
        format(
          'Aviso: O componente "%s" possui lote vencido "%s" (venc: %s, saldo: %s %s). Este lote não foi consumido na montagem e deve ser baixado como perda.',
          v_comp_item.componente_nome,
          v_lote_vencido.numero_lote,
          to_char(v_lote_vencido.data_validade, 'DD/MM/YYYY'),
          v_lote_vencido.quantidade,
          v_comp_item.unidade
        )
      );
    END LOOP;
  END LOOP;

  -- Se faltar componente ou se faltar saldo válido, abortar com mensagem clara
  IF v_falta_msg <> '' THEN
    RAISE EXCEPTION 'Não é possível finalizar a montagem da ordem #%:%', v_ordem.numero, v_falta_msg;
  END IF;

  -- 5. Baixar componentes com FEFO EXCLUSIVAMENTE nos lotes VÁLIDOS
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

    -- Consumir lotes por FEFO (apenas lotes VÁLIDOS: data_validade >= v_hoje_sp OU sem validade)
    v_falta_consumir_lote := v_necessario;

    FOR v_lote_fefo IN
      SELECT l.id, l.numero_lote, l.data_validade, l.quantidade
      FROM public.lotes l
      WHERE l.empresa_id = v_empresa_id
        AND l.produto_id = v_comp_item.componente_produto_id
        AND l.quantidade > 0
        AND (l.data_validade IS NULL OR l.data_validade >= v_hoje_sp)
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
    'status', 'concluida',
    'avisos', to_jsonb(v_avisos)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalizar_montagem_cestas(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_montagem_cestas(uuid, numeric) TO authenticated, service_role;
