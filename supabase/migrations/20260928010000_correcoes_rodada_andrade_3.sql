-- Migration: 20260928010000_correcoes_rodada_andrade_3.sql
-- Rodada Andrade 3: Correção de movimentacoes_estoque_tipo_check, restrição de escrita em rotas/veiculos,
-- RPC criar_rota com numeração sequencial por empresa e trava, revogação de anon em is_entregador e RPCs de rotas,
-- e garantia da regra de limite de crédito nas 3 funções operacionais.

-- ============================================================================
-- 1. ATUALIZAR CONSTRAINT movimentacoes_estoque_tipo_check
-- ============================================================================
-- As funções de rotas gravam:
-- - carregar_veiculo_rota: 'transferencia_saida'
-- - vender_na_rua: não grava em movimentacoes_estoque (baixa apenas de rota_itens_estoque)
-- - concluir_entrega_pedido_rota: não grava em movimentacoes_estoque (baixa de rota_itens_estoque)
-- - fechar_rota_acerto: 'transferencia_entrada'
-- - Outros tipos do sistema: 'entrada', 'saida', 'ajuste', 'perda', 'devolucao', 'consumo_montagem', 'entrada_montagem'
ALTER TABLE public.movimentacoes_estoque
  DROP CONSTRAINT IF EXISTS movimentacoes_estoque_tipo_check;

ALTER TABLE public.movimentacoes_estoque
  ADD CONSTRAINT movimentacoes_estoque_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'entrada'::text,
    'saida'::text,
    'ajuste'::text,
    'perda'::text,
    'devolucao'::text,
    'consumo_montagem'::text,
    'entrada_montagem'::text,
    'transferencia_saida'::text,
    'transferencia_entrada'::text
  ]));

-- ============================================================================
-- 2. POLICIES DE ROTAS E VEÍCULOS (FECHAR ESCRITA DIRETA)
-- ============================================================================
-- Rotas: remover INSERT direto e UPDATE direto. Leitura continua multitenant.
-- Criação de rota só via RPC criar_rota; mudanças de status só pelas RPCs existentes (carregar, fechar).
DROP POLICY IF EXISTS "rotas_insert_empresa" ON public.rotas;
DROP POLICY IF EXISTS "rotas_update_empresa" ON public.rotas;

-- Veículos: escrita (INSERT e UPDATE) restrita a gerente ou superior (is_manager_or_above()).
DROP POLICY IF EXISTS "veiculos_insert_empresa" ON public.veiculos;
CREATE POLICY "veiculos_insert_empresa" ON public.veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_manager_or_above()
  );

DROP POLICY IF EXISTS "veiculos_update_empresa" ON public.veiculos;
CREATE POLICY "veiculos_update_empresa" ON public.veiculos
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_manager_or_above()
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND public.is_manager_or_above()
  );

-- ============================================================================
-- 3. RPC criar_rota COM TRAVA E NUMERAÇÃO SEQUENCIAL POR EMPRESA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.criar_rota(
  p_veiculo_id uuid,
  p_responsavel_usuario_id uuid,
  p_data date DEFAULT CURRENT_DATE,
  p_observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_perfil text;
  v_numero bigint;
  v_rota_id uuid;
  v_veiculo record;
  v_responsavel record;
BEGIN
  -- Validar módulo entregas
  IF NOT public.empresa_tem_modulo('modulo_entregas') THEN
    RAISE EXCEPTION 'O módulo Entregas não está habilitado para esta empresa.';
  END IF;

  -- 1. IDENTIFICAR USUÁRIO AUTENTICADO
  SELECT u.id, u.empresa_id, u.perfil
  INTO v_usuario_id, v_empresa_id, v_perfil
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
    AND u.ativo = true
  LIMIT 1;

  IF v_usuario_id IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  -- 2. PERMISSÃO: Gerente ou superior
  IF NOT public.is_manager_or_above() THEN
    RAISE EXCEPTION 'Apenas gerentes ou administradores podem criar rotas.';
  END IF;

  -- 3. VALIDAR VEÍCULO
  SELECT * INTO v_veiculo
  FROM public.veiculos
  WHERE id = p_veiculo_id
    AND empresa_id = v_empresa_id
    AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veículo não encontrado, inativo ou pertencente a outra empresa.';
  END IF;

  -- 4. VALIDAR RESPONSÁVEL
  SELECT * INTO v_responsavel
  FROM public.usuarios
  WHERE id = p_responsavel_usuario_id
    AND empresa_id = v_empresa_id
    AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário responsável não encontrado, inativo ou pertencente a outra empresa.';
  END IF;

  -- 5. NUMERAÇÃO SEQUENCIAL POR EMPRESA COM ADVISORY LOCK
  PERFORM pg_advisory_xact_lock(hashtext('empresa_rotas_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.rotas
  WHERE empresa_id = v_empresa_id;

  -- 6. INSERIR ROTA
  INSERT INTO public.rotas (
    empresa_id,
    numero,
    data,
    veiculo_id,
    responsavel_usuario_id,
    status,
    observacoes,
    created_by
  ) VALUES (
    v_empresa_id,
    v_numero,
    COALESCE(p_data, CURRENT_DATE),
    p_veiculo_id,
    p_responsavel_usuario_id,
    'aberta',
    p_observacoes,
    v_usuario_id
  )
  RETURNING id INTO v_rota_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'rota_id', v_rota_id,
    'numero', v_numero,
    'veiculo_id', p_veiculo_id,
    'responsavel_usuario_id', p_responsavel_usuario_id,
    'data', COALESCE(p_data, CURRENT_DATE),
    'status', 'aberta'
  );
END;
$$;

-- ============================================================================
-- 4. SEGURANÇA E REVOGAÇÃO DE PRIVILÉGIOS (REVOKE DE PUBLIC E anon)
-- ============================================================================
-- is_entregador
REVOKE EXECUTE ON FUNCTION public.is_entregador() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_entregador() TO authenticated, service_role;

-- criar_rota
REVOKE EXECUTE ON FUNCTION public.criar_rota(uuid, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_rota(uuid, uuid, date, text) TO authenticated, service_role;

-- carregar_veiculo_rota
REVOKE EXECUTE ON FUNCTION public.carregar_veiculo_rota(uuid, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carregar_veiculo_rota(uuid, jsonb, uuid[]) TO authenticated, service_role;

-- vender_na_rua
REVOKE EXECUTE ON FUNCTION public.vender_na_rua(uuid, uuid, jsonb, text, text, jsonb, numeric, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vender_na_rua(uuid, uuid, jsonb, text, text, jsonb, numeric, text, integer, integer, text) TO authenticated, service_role;

-- concluir_entrega_pedido_rota
REVOKE EXECUTE ON FUNCTION public.concluir_entrega_pedido_rota(uuid, uuid, boolean, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_entrega_pedido_rota(uuid, uuid, boolean, text, jsonb, text) TO authenticated, service_role;

-- fechar_rota_acerto
REVOKE EXECUTE ON FUNCTION public.fechar_rota_acerto(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_rota_acerto(uuid, jsonb, text) TO authenticated, service_role;

-- ============================================================================
-- 5. ATUALIZAÇÃO DE converter_pedido_em_venda COM REGRA DE LIMITE DE CRÉDITO
-- ============================================================================
-- Garantir que nas 3 funções (finalizar_venda, vender_na_rua e converter_pedido_em_venda)
-- estouro de limite só é aceito se o usuário logado (auth.uid()) for master/admin/gerente,
-- p_autorizador_id de terceiros ignorado e registro em auditoria_operacoes com referencia_id = venda_id.

CREATE OR REPLACE FUNCTION public.converter_pedido_em_venda(
  p_pedido_id uuid,
  p_forma_pagamento text DEFAULT 'pix'::text,
  p_vencimento date DEFAULT NULL::date,
  p_pagamentos jsonb DEFAULT NULL::jsonb,
  p_parcelas jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_perfil text;

  v_assinatura_id uuid;
  v_limite_vendas_mes integer;
  v_vendas_mes_count integer;
  v_primeiro_dia_mes timestamptz;

  v_pedido record;
  v_item record;

  v_venda_id uuid;
  v_numero_venda bigint;

  v_comissao_percentual numeric(5,2) := 0;
  v_valor_comissao numeric(14,2) := 0;

  v_estoque record;
  v_modulo_cestas boolean;
  v_modulo_crediario boolean;
  v_status_ass jsonb;

  v_pag jsonb;
  v_soma_pagamentos numeric(14,2) := 0;

  -- Crediário / Limite de crédito
  v_cliente record;
  v_saldo_devedor_atual numeric(14,2) := 0;
  v_tem_vencida boolean := false;
  v_novo_saldo numeric(14,2) := 0;
  v_houve_estouro boolean := false;
  v_parc jsonb;
  v_i integer;
  v_qtd_parc integer;
  v_soma_parc numeric(14,2) := 0;
BEGIN
  -- 0. Validar status da assinatura
  v_status_ass := public.get_status_assinatura();
  IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
  END IF;

  -- 1. IDENTIFICAR USUÁRIO AUTENTICADO
  SELECT
    u.id,
    u.empresa_id,
    u.perfil
  INTO
    v_usuario_id,
    v_empresa_id,
    v_perfil
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
    AND u.ativo = true
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não está vinculado a uma empresa.';
  END IF;

  -- 2. VALIDAR PERMISSÃO
  IF v_perfil NOT IN ('master', 'admin', 'gerente', 'vendedor') THEN
    RAISE EXCEPTION 'Usuário não possui permissão para converter pedidos em venda.';
  END IF;

  -- SERIALIZAR OPERAÇÃO DE LIMITE (FOR UPDATE)
  SELECT a.id, p.limite_vendas_mes
  INTO v_assinatura_id, v_limite_vendas_mes
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = v_empresa_id
    AND a.status IN ('trial', 'ativa')
  FOR UPDATE;

  -- 3. VALIDAR LIMITE DE VENDAS DO PLANO NO MÊS (SP timezone)
  IF v_limite_vendas_mes IS NOT NULL THEN
    v_primeiro_dia_mes := public.sp_month_start(now());

    SELECT count(*)
    INTO v_vendas_mes_count
    FROM public.vendas
    WHERE empresa_id = v_empresa_id
      AND status = 'finalizada'
      AND created_at >= v_primeiro_dia_mes;

    IF v_vendas_mes_count >= v_limite_vendas_mes THEN
      RAISE EXCEPTION 'Limite de vendas do plano atingido para este mês. Faça upgrade do seu plano para aumentar sua capacidade.';
    END IF;
  END IF;

  -- 4. TRAVAR PEDIDO E VALIDAR
  SELECT *
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou pertence a outra empresa.';
  END IF;

  IF v_pedido.status NOT IN ('pendente', 'confirmado', 'faturado') THEN
    RAISE EXCEPTION 'Somente pedidos pendentes ou confirmados podem ser convertidos em venda. Status atual: %.', v_pedido.status;
  END IF;

  v_modulo_cestas := public.empresa_tem_modulo('modulo_cestas');
  v_modulo_crediario := public.empresa_tem_modulo('modulo_crediario');

  -- 5. VALIDAR CLIENTE E LIMITE DE CRÉDITO SE FOR CREDIÁRIO/FIADO OU PARCELADO
  IF v_pedido.cliente_id IS NOT NULL THEN
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = v_pedido.cliente_id
      AND empresa_id = v_empresa_id
      AND ativo = true;
  END IF;

  IF lower(p_forma_pagamento) IN ('fiado', 'crediario') OR (p_parcelas IS NOT NULL AND jsonb_array_length(p_parcelas) > 0) THEN
    IF NOT v_modulo_crediario AND lower(p_forma_pagamento) <> 'fiado' THEN
      RAISE EXCEPTION 'O módulo Crediário não está habilitado para esta empresa.';
    END IF;

    IF v_pedido.cliente_id IS NULL OR v_cliente.id IS NULL THEN
      RAISE EXCEPTION 'Venda parcelada ou fiada exige cliente identificado.';
    END IF;

    SELECT
      COALESCE(SUM(cr.valor - cr.valor_pago), 0),
      EXISTS (
        SELECT 1 FROM public.contas_receber
        WHERE cliente_id = v_pedido.cliente_id
          AND status IN ('pendente', 'atrasado')
          AND vencimento < public.sp_date(now())
      )
    INTO v_saldo_devedor_atual, v_tem_vencida
    FROM public.contas_receber cr
    WHERE cr.cliente_id = v_pedido.cliente_id
      AND cr.status IN ('pendente', 'atrasado');

    v_novo_saldo := v_saldo_devedor_atual + v_pedido.total;

    -- REGRA ANDRADE: Estouro de limite de crédito só é aceito se QUEM ESTÁ LOGADO for gerente ou acima
    IF COALESCE(v_cliente.limite_credito, 0) > 0 AND v_novo_saldo > v_cliente.limite_credito THEN
      IF v_perfil NOT IN ('master', 'admin', 'gerente') THEN
        RAISE EXCEPTION 'Limite excedido — peça a um gerente para concluir a venda';
      END IF;
      v_houve_estouro := true;
    END IF;
  END IF;

  -- 6. VALIDAR E BAIXAR ESTOQUE CONJUNTAMENTE (FÍSICO E RESERVA SE HAVIA SIDO CONFIRMADO)
  FOR v_item IN
    SELECT
      ip.produto_id,
      ip.quantidade,
      ip.preco_unitario,
      ip.desconto,
      ip.subtotal,
      p.nome AS produto_nome,
      p.preco_custo,
      p.tipo_item
    FROM public.itens_pedido ip
    JOIN public.produtos p ON p.id = ip.produto_id
    WHERE ip.pedido_id = p_pedido_id
      AND ip.empresa_id = v_empresa_id
    ORDER BY ip.produto_id
  LOOP
    IF v_modulo_cestas AND v_item.tipo_item = 'componente' THEN
      RAISE EXCEPTION 'O pedido contém o item "%" que é um componente. Empresas com o módulo de cestas vendem apenas cestas prontas.', v_item.produto_nome;
    END IF;

    SELECT *
    INTO v_estoque
    FROM public.estoques
    WHERE produto_id = v_item.produto_id
      AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto "%" não possui estoque registrado na empresa.', v_item.produto_nome;
    END IF;

    IF v_estoque.quantidade < v_item.quantidade THEN
      RAISE EXCEPTION 'Estoque físico insuficiente para o produto "%": físico %, solicitado %.',
        v_item.produto_nome,
        v_estoque.quantidade,
        v_item.quantidade;
    END IF;
  END LOOP;

  -- 7. NUMERAÇÃO DA VENDA COM LOCK POR EMPRESA
  PERFORM pg_advisory_xact_lock(hashtext('empresa_venda_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero_venda
  FROM public.vendas
  WHERE empresa_id = v_empresa_id;

  -- 8. CRIAR VENDA
  INSERT INTO public.vendas (
    empresa_id,
    cliente_id,
    vendedor_id,
    numero,
    subtotal,
    desconto,
    total,
    forma_pagamento,
    status,
    observacoes,
    created_by,
    pedido_id
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id,
    v_pedido.cliente_id,
    v_pedido.vendedor_id,
    v_numero_venda,
    v_pedido.total,
    0,
    v_pedido.total,
    lower(p_forma_pagamento),
    'finalizada',
    COALESCE(v_pedido.observacoes, '') || ' (Convertido do Pedido #' || v_pedido.numero || ')',
    v_usuario_id,
    p_pedido_id
  )
  RETURNING id INTO v_venda_id;

  -- Registrar auditoria de estouro de limite se foi autorizado pelo gerente/admin logado
  IF v_houve_estouro THEN
    INSERT INTO public.auditoria_operacoes (
      empresa_id,
      usuario_id,
      tipo_operacao,
      referencia_id,
      tabela_referencia,
      motivo,
      detalhes
    ) VALUES (
      v_empresa_id,
      v_usuario_id,
      'estouro_limite_credito',
      v_venda_id,
      'vendas',
      'Autorização de estouro de limite de crédito na conversão de pedido pelo usuário autenticado (' || v_perfil || ')',
      jsonb_build_object(
        'pedido_id', p_pedido_id,
        'pedido_numero', v_pedido.numero,
        'cliente_id', v_pedido.cliente_id,
        'limite_credito', v_cliente.limite_credito,
        'saldo_anterior', v_saldo_devedor_atual,
        'novo_saldo', v_novo_saldo,
        'venda_numero', v_numero_venda
      )
    );
  END IF;

  -- 9. TRANSFERIR ITENS E BAIXAR ESTOQUE FÍSICO + RESERVA
  FOR v_item IN
    SELECT
      ip.produto_id,
      ip.quantidade,
      ip.preco_unitario,
      ip.desconto,
      ip.subtotal,
      p.preco_custo
    FROM public.itens_pedido ip
    JOIN public.produtos p ON p.id = ip.produto_id
    WHERE ip.pedido_id = p_pedido_id
      AND ip.empresa_id = v_empresa_id
  LOOP
    INSERT INTO public.itens_venda (
      empresa_id,
      venda_id,
      produto_id,
      quantidade,
      preco_unitario,
      desconto,
      subtotal,
      custo_unitario
    )
    VALUES (
      v_empresa_id,
      v_venda_id,
      v_item.produto_id,
      v_item.quantidade,
      v_item.preco_unitario,
      COALESCE(v_item.desconto, 0),
      v_item.subtotal,
      COALESCE(v_item.preco_custo, 0)
    );

    IF v_pedido.status IN ('confirmado', 'faturado') THEN
      UPDATE public.estoques
      SET
        quantidade = quantidade - v_item.quantidade,
        quantidade_reservada = GREATEST(0, quantidade_reservada - v_item.quantidade),
        updated_at = now()
      WHERE produto_id = v_item.produto_id
        AND empresa_id = v_empresa_id;
    ELSE
      UPDATE public.estoques
      SET
        quantidade = quantidade - v_item.quantidade,
        updated_at = now()
      WHERE produto_id = v_item.produto_id
        AND empresa_id = v_empresa_id;
    END IF;

    INSERT INTO public.movimentacoes_estoque (
      empresa_id,
      produto_id,
      tipo,
      quantidade,
      motivo,
      referencia_id,
      usuario_id
    )
    VALUES (
      v_empresa_id,
      v_item.produto_id,
      'saida',
      v_item.quantidade,
      'Venda #' || v_numero_venda || ' (Convertida do Pedido #' || v_pedido.numero || ')',
      v_venda_id,
      v_usuario_id
    );
  END LOOP;

  -- 10. ATUALIZAR STATUS DO PEDIDO PARA FATURADO
  UPDATE public.pedidos
  SET status = 'faturado', updated_at = now()
  WHERE id = p_pedido_id;

  -- 11. FINANCEIRO / PAGAMENTO DIVIDIDO / PARCELAS
  IF p_pagamentos IS NOT NULL AND jsonb_typeof(p_pagamentos) = 'array' AND jsonb_array_length(p_pagamentos) > 0 THEN
    FOR v_pag IN SELECT * FROM jsonb_array_elements(p_pagamentos)
    LOOP
      v_soma_pagamentos := v_soma_pagamentos + (v_pag->>'valor')::numeric;
      INSERT INTO public.venda_pagamentos (
        empresa_id,
        venda_id,
        forma,
        valor,
        status,
        data,
        referencia
      ) VALUES (
        v_empresa_id,
        v_venda_id,
        lower(v_pag->>'forma'),
        (v_pag->>'valor')::numeric,
        COALESCE(v_pag->>'status', 'recebido'),
        COALESCE((v_pag->>'data')::date, CURRENT_DATE),
        v_pag->>'referencia'
      );
    END LOOP;

    IF round(v_soma_pagamentos, 2) <> round(v_pedido.total, 2) THEN
      RAISE EXCEPTION 'A soma dos pagamentos divididos (%) não confere com o total da venda (%).',
        round(v_soma_pagamentos, 2), round(v_pedido.total, 2);
    END IF;

  ELSIF p_parcelas IS NOT NULL AND jsonb_typeof(p_parcelas) = 'array' AND jsonb_array_length(p_parcelas) > 0 THEN
    v_qtd_parc := jsonb_array_length(p_parcelas);
    FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas)
    LOOP
      v_soma_parc := v_soma_parc + (v_parc->>'valor')::numeric;
      INSERT INTO public.contas_receber (
        empresa_id,
        cliente_id,
        venda_id,
        descricao,
        valor,
        vencimento,
        status,
        numero_parcela,
        autorizador_id
      ) VALUES (
        v_empresa_id,
        v_pedido.cliente_id,
        v_venda_id,
        'Venda #' || v_numero_venda || ' (' || COALESCE(v_parc->>'numero', '1') || '/' || v_qtd_parc || ')',
        (v_parc->>'valor')::numeric,
        (v_parc->>'vencimento')::date,
        'pendente',
        COALESCE(v_parc->>'numero', '1') || '/' || v_qtd_parc,
        CASE WHEN v_houve_estouro THEN v_usuario_id ELSE NULL END
      );
    END LOOP;

  ELSIF lower(p_forma_pagamento) IN ('fiado', 'crediario') THEN
    INSERT INTO public.contas_receber (
      empresa_id,
      cliente_id,
      venda_id,
      descricao,
      valor,
      vencimento,
      status,
      numero_parcela,
      autorizador_id
    )
    VALUES (
      v_empresa_id,
      v_pedido.cliente_id,
      v_venda_id,
      'Venda #' || v_numero_venda || ' (Pedido #' || v_pedido.numero || ')',
      v_pedido.total,
      COALESCE(p_vencimento, public.sp_date(now())),
      'pendente',
      '1/1',
      CASE WHEN v_houve_estouro THEN v_usuario_id ELSE NULL END
    );
  ELSE
    INSERT INTO public.venda_pagamentos (
      empresa_id,
      venda_id,
      forma,
      valor,
      status,
      data
    ) VALUES (
      v_empresa_id,
      v_venda_id,
      lower(p_forma_pagamento),
      v_pedido.total,
      'recebido',
      CURRENT_DATE
    );
  END IF;

  -- 12. COMISSÃO
  IF v_pedido.vendedor_id IS NOT NULL THEN
    SELECT percentual_comissao
    INTO v_comissao_percentual
    FROM public.vendedores
    WHERE id = v_pedido.vendedor_id
      AND empresa_id = v_empresa_id
      AND ativo = true;

    IF FOUND AND v_comissao_percentual > 0 THEN
      v_valor_comissao := round(v_pedido.total * (v_comissao_percentual / 100), 2);

      INSERT INTO public.comissoes (
        empresa_id,
        vendedor_id,
        venda_id,
        percentual,
        valor_venda,
        valor_comissao,
        status
      )
      VALUES (
        v_empresa_id,
        v_pedido.vendedor_id,
        v_venda_id,
        v_comissao_percentual,
        v_pedido.total,
        v_valor_comissao,
        'pendente'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'venda_id', v_venda_id,
    'numero_venda', v_numero_venda,
    'pedido_id', p_pedido_id,
    'pedido_numero', v_pedido.numero,
    'total', v_pedido.total,
    'status_pedido', 'faturado'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.converter_pedido_em_venda(uuid, text, date, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.converter_pedido_em_venda(uuid, text, date, jsonb, jsonb) TO authenticated, service_role;
