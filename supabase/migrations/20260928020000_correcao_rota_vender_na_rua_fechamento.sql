-- Migration: 20260928020000_correcao_rota_vender_na_rua_fechamento.sql
-- Correção pontual da rota (rodada pós-Andrade 3, v0.0.123):
-- 1. vender_na_rua: saldo vendável do carro passa a ser LIVRE = carregada - vendida - entregue - reservas_pedidos_pendentes.
--    Recusa quando a venda exceder o livre com mensagem clara em português citando o pedido ("Essa cesta está reservada para o pedido #X").
-- 2. fechar_rota_acerto:
--    - conferência MAIOR que o esperado -> RECUSAR a operação com mensagem clara e registrar divergência em auditoria_operacoes;
--    - conferência MENOR que o esperado -> devolver o que foi conferido ao depósito e registrar a FALTA como divergência em auditoria_operacoes;
--    - as cestas de pedidos não entregues/pendentes voltam ao depósito como RESERVA (quantidade_reservada do depósito);
--    - o restante volta como DISPONÍVEL (quantidade do depósito aumentada em conferido, quantidade_reservada aumentada no que for de pedidos não entregues).
--    Elimina completamente o estoque fantasma.

-- ============================================================================
-- 1. RPC vender_na_rua
-- ============================================================================
CREATE OR REPLACE FUNCTION public.vender_na_rua(
  p_rota_id uuid,
  p_cliente_id uuid,
  p_itens jsonb,
  p_forma_pagamento text DEFAULT 'pix'::text,
  p_condicao text DEFAULT 'a_vista'::text,
  p_pagamentos jsonb DEFAULT NULL::jsonb,
  p_entrada_valor numeric DEFAULT 0,
  p_entrada_forma text DEFAULT 'dinheiro'::text,
  p_num_parcelas integer DEFAULT 1,
  p_intervalo_dias integer DEFAULT 30,
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
  v_vendedor_id uuid;
  v_rota record;
  v_venda_id uuid;
  v_numero bigint;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric(14,3);
  v_preco numeric(14,2);
  v_preco_custo numeric(14,2);
  v_subtotal_item numeric(14,2);
  v_estoque_carro record;
  v_a_bordo numeric;
  v_reservado_pendente numeric;
  v_livre_venda numeric;
  v_primeiro_pedido_bloq bigint;
  v_cliente record;
  v_saldo_devedor_atual numeric(14,2) := 0;
  v_tem_vencida boolean := false;
  v_novo_saldo numeric(14,2) := 0;
  v_houve_estouro boolean := false;
  v_comissao_percentual numeric(5,2) := 0;
  v_valor_comissao numeric(14,2) := 0;

  -- Parcelas
  v_valor_a_financiar numeric(14,2) := 0;
  v_valor_base_parcela numeric(14,2);
  v_valor_ultima_parcela numeric(14,2);
  v_soma_parcelas_base numeric(14,2);
  v_vencimento_parc date;
  v_idx integer;

  -- Pagamento dividido
  v_pag jsonb;
  v_soma_divida numeric(14,2) := 0;
BEGIN
  -- Validar módulo entregas
  IF NOT public.empresa_tem_modulo('modulo_entregas') THEN
    RAISE EXCEPTION 'O módulo Entregas não está habilitado para esta empresa.';
  END IF;

  -- Identificar usuário
  SELECT u.id, u.empresa_id, u.perfil
  INTO v_usuario_id, v_empresa_id, v_perfil
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true
  LIMIT 1;

  IF v_usuario_id IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  -- Resolver vendedor_id se existir para o usuário
  SELECT id, percentual_comissao INTO v_vendedor_id, v_comissao_percentual
  FROM public.vendedores
  WHERE usuario_id = v_usuario_id AND empresa_id = v_empresa_id AND ativo = true
  LIMIT 1;

  -- Travar rota FOR UPDATE
  SELECT * INTO v_rota
  FROM public.rotas
  WHERE id = p_rota_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada.';
  END IF;

  IF v_rota.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'A rota #% não está em andamento (status atual: %). Vendas na rua só são permitidas com a rota em andamento.',
      v_rota.numero, v_rota.status;
  END IF;

  -- Regra: Vendedor/entregador só vende da sua própria rota. Master/Admin/Gerente pode apoiar qualquer rota
  IF v_perfil IN ('vendedor', 'entregador') AND v_rota.responsavel_usuario_id <> v_usuario_id THEN
    RAISE EXCEPTION 'Você só pode registrar vendas na sua própria rota em andamento.';
  END IF;

  -- Validar itens
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A venda precisa possuir pelo menos um produto.';
  END IF;

  -- Validar cliente
  IF p_cliente_id IS NOT NULL THEN
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = p_cliente_id AND empresa_id = v_empresa_id AND ativo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente inválido ou inativo.';
    END IF;
  END IF;

  -- Validar estoque livre do CARRO para cada produto solicitado
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::numeric;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para um dos produtos.';
    END IF;

    SELECT preco_venda, preco_custo, nome
    INTO v_preco, v_preco_custo
    FROM public.produtos
    WHERE id = v_produto_id AND empresa_id = v_empresa_id;

    -- Travar linha do estoque da rota
    SELECT * INTO v_estoque_carro
    FROM public.rota_itens_estoque
    WHERE rota_id = p_rota_id AND produto_id = v_produto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'O produto não está carregado no veículo desta rota.';
    END IF;

    -- Saldo físico atual a bordo no carro
    v_a_bordo := v_estoque_carro.quantidade_carregada - (
      v_estoque_carro.quantidade_vendida + v_estoque_carro.quantidade_entregue + v_estoque_carro.quantidade_devolvida
    );

    -- Somar reservas para pedidos da rota ainda PENDENTES de entrega (status_entrega NOT IN ('entregue') e pedido não faturado/cancelado)
    SELECT COALESCE(SUM(ip.quantidade), 0)
    INTO v_reservado_pendente
    FROM public.rota_pedidos rp
    JOIN public.pedidos p ON p.id = rp.pedido_id
    JOIN public.itens_pedido ip ON ip.pedido_id = p.id AND ip.produto_id = v_produto_id
    WHERE rp.rota_id = p_rota_id
      AND rp.empresa_id = v_empresa_id
      AND rp.status_entrega IN ('pendente', 'nao_entregue')
      AND p.status NOT IN ('faturado', 'cancelado');

    -- Saldo vendável LIVRE no carro
    v_livre_venda := GREATEST(0, v_a_bordo - v_reservado_pendente);

    IF v_quantidade > v_livre_venda THEN
      IF v_reservado_pendente > 0 AND (v_a_bordo - v_livre_venda) > 0 THEN
        -- Identificar o número do pedido reservado para a mensagem clara
        SELECT p.numero
        INTO v_primeiro_pedido_bloq
        FROM public.rota_pedidos rp
        JOIN public.pedidos p ON p.id = rp.pedido_id
        JOIN public.itens_pedido ip ON ip.pedido_id = p.id AND ip.produto_id = v_produto_id
        WHERE rp.rota_id = p_rota_id
          AND rp.empresa_id = v_empresa_id
          AND rp.status_entrega IN ('pendente', 'nao_entregue')
          AND p.status NOT IN ('faturado', 'cancelado')
        ORDER BY rp.ordem_entrega ASC
        LIMIT 1;

        RAISE EXCEPTION 'Essa cesta está reservada para o pedido #% (saldo livre para venda: %, solicitado: %).',
          v_primeiro_pedido_bloq, v_livre_venda, v_quantidade;
      ELSE
        RAISE EXCEPTION 'Estoque no veículo insuficiente para venda na rua (disponível no carro: %, solicitado: %).',
          v_livre_venda, v_quantidade;
      END IF;
    END IF;

    v_subtotal_item := round(v_quantidade * v_preco, 2);
    v_subtotal := v_subtotal + v_subtotal_item;
  END LOOP;

  v_total := v_subtotal;

  -- Regras de crediário / parcelamento / limite
  IF p_condicao = 'parcelado' OR lower(p_forma_pagamento) IN ('crediario', 'fiado') THEN
    IF NOT public.empresa_tem_modulo('modulo_crediario') AND lower(p_forma_pagamento) <> 'fiado' THEN
      RAISE EXCEPTION 'O módulo Crediário não está habilitado para esta empresa.';
    END IF;

    IF p_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Venda parcelada exige cliente identificado.';
    END IF;

    IF v_cliente.telefone IS NULL OR trim(v_cliente.telefone) = '' THEN
      RAISE EXCEPTION 'Venda parcelada exige cliente com telefone cadastrado.';
    END IF;

    IF p_num_parcelas IS NULL OR p_num_parcelas < 1 THEN
      p_num_parcelas := 1;
    END IF;

    IF p_entrada_valor IS NULL THEN
      p_entrada_valor := 0;
    END IF;

    v_valor_a_financiar := round(v_total - p_entrada_valor, 2);

    SELECT
      COALESCE(SUM(cr.valor - cr.valor_pago), 0),
      EXISTS (
        SELECT 1 FROM public.contas_receber
        WHERE cliente_id = p_cliente_id
          AND status IN ('pendente', 'atrasado')
          AND vencimento < public.sp_date(now())
      )
    INTO v_saldo_devedor_atual, v_tem_vencida
    FROM public.contas_receber cr
    WHERE cr.cliente_id = p_cliente_id AND cr.status IN ('pendente', 'atrasado');

    v_novo_saldo := v_saldo_devedor_atual + v_valor_a_financiar;

    IF COALESCE(v_cliente.limite_credito, 0) > 0 AND v_novo_saldo > v_cliente.limite_credito THEN
      IF v_perfil NOT IN ('master', 'admin', 'gerente') THEN
        RAISE EXCEPTION 'Limite excedido — peça a um gerente para concluir a venda';
      END IF;
      v_houve_estouro := true;
    END IF;
  END IF;

  -- Lock de numeração de venda
  PERFORM pg_advisory_xact_lock(hashtext('empresa_venda_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.vendas
  WHERE empresa_id = v_empresa_id;

  -- Criar venda
  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total,
    forma_pagamento, status, observacoes, created_by
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, p_cliente_id, v_vendedor_id, v_numero, v_subtotal, 0, v_total,
    CASE WHEN p_condicao = 'parcelado' THEN 'crediario' ELSE lower(p_forma_pagamento) END,
    'finalizada',
    COALESCE(p_observacoes, '') || ' [Venda na Rua - Rota #' || v_rota.numero || ']',
    v_usuario_id
  )
  RETURNING id INTO v_venda_id;

  -- Auditoria de limite se houve estouro
  IF v_houve_estouro THEN
    INSERT INTO public.auditoria_operacoes (
      empresa_id, usuario_id, tipo_operacao, referencia_id, tabela_referencia, motivo, detalhes
    ) VALUES (
      v_empresa_id, v_usuario_id, 'estouro_limite_credito', v_venda_id, 'vendas',
      'Autorização de estouro de limite na rua pelo usuário autenticado (' || v_perfil || ')',
      jsonb_build_object(
        'rota_id', p_rota_id,
        'rota_numero', v_rota.numero,
        'cliente_id', p_cliente_id,
        'limite_credito', v_cliente.limite_credito,
        'saldo_anterior', v_saldo_devedor_atual,
        'novo_saldo', v_novo_saldo,
        'venda_numero', v_numero
      )
    );
  END IF;

  -- Inserir itens de venda e BAIXAR SOMENTE DO ESTOQUE DO CARRO
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::numeric;

    SELECT preco_venda, preco_custo
    INTO v_preco, v_preco_custo
    FROM public.produtos
    WHERE id = v_produto_id AND empresa_id = v_empresa_id;

    v_subtotal_item := round(v_quantidade * v_preco, 2);

    INSERT INTO public.itens_venda (
      empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario
    ) VALUES (
      v_empresa_id, v_venda_id, v_produto_id, v_quantidade, v_preco, 0, v_subtotal_item, v_preco_custo
    );

    UPDATE public.rota_itens_estoque
    SET quantidade_vendida = quantidade_vendida + v_quantidade,
        updated_at = now()
    WHERE rota_id = p_rota_id AND produto_id = v_produto_id;
  END LOOP;

  -- Financeiro
  IF p_condicao = 'parcelado' THEN
    IF p_entrada_valor > 0 THEN
      INSERT INTO public.venda_pagamentos (
        empresa_id, venda_id, forma, valor, status, data, referencia
      ) VALUES (
        v_empresa_id, v_venda_id, lower(p_entrada_forma), p_entrada_valor, 'recebido',
        CURRENT_DATE, 'Entrada Venda na Rua #' || v_numero || ' - Rota #' || v_rota.numero
      );
    END IF;

    IF v_valor_a_financiar > 0 THEN
      v_valor_base_parcela := trunc((v_valor_a_financiar / p_num_parcelas)::numeric, 2);
      v_soma_parcelas_base := v_valor_base_parcela * (p_num_parcelas - 1);
      v_valor_ultima_parcela := round(v_valor_a_financiar - v_soma_parcelas_base, 2);

      FOR v_idx IN 1..p_num_parcelas LOOP
        v_vencimento_parc := CURRENT_DATE + ((v_idx * COALESCE(p_intervalo_dias, 30)) || ' days')::interval;

        INSERT INTO public.contas_receber (
          empresa_id, cliente_id, venda_id, descricao, valor, vencimento, status, numero_parcela, autorizador_id
        ) VALUES (
          v_empresa_id, p_cliente_id, v_venda_id,
          'Venda na Rua #' || v_numero || ' (' || v_idx || '/' || p_num_parcelas || ')',
          CASE WHEN v_idx = p_num_parcelas THEN v_valor_ultima_parcela ELSE v_valor_base_parcela END,
          v_vencimento_parc, 'pendente', v_idx || '/' || p_num_parcelas,
          CASE WHEN v_houve_estouro THEN v_usuario_id ELSE NULL END
        );
      END LOOP;
    END IF;

  ELSIF p_pagamentos IS NOT NULL AND jsonb_typeof(p_pagamentos) = 'array' AND jsonb_array_length(p_pagamentos) > 0 THEN
    FOR v_pag IN SELECT * FROM jsonb_array_elements(p_pagamentos)
    LOOP
      v_soma_divida := v_soma_divida + (v_pag->>'valor')::numeric;
      INSERT INTO public.venda_pagamentos (
        empresa_id, venda_id, forma, valor, status, data, referencia
      ) VALUES (
        v_empresa_id, v_venda_id, lower(v_pag->>'forma'), (v_pag->>'valor')::numeric,
        COALESCE(v_pag->>'status', 'recebido'), COALESCE((v_pag->>'data')::date, CURRENT_DATE),
        COALESCE(v_pag->>'referencia', 'Rota #' || v_rota.numero)
      );
    END LOOP;

    IF round(v_soma_divida, 2) <> round(v_total, 2) THEN
      RAISE EXCEPTION 'A soma dos pagamentos divididos (%) não confere com o total (%).',
        round(v_soma_divida, 2), round(v_total, 2);
    END IF;

  ELSE
    INSERT INTO public.venda_pagamentos (
      empresa_id, venda_id, forma, valor, status, data, referencia
    ) VALUES (
      v_empresa_id, v_venda_id, lower(p_forma_pagamento), v_total, 'recebido', CURRENT_DATE,
      'Rota #' || v_rota.numero
    );
  END IF;

  -- Comissões
  IF v_vendedor_id IS NOT NULL AND v_comissao_percentual > 0 THEN
    v_valor_comissao := round(v_total * (v_comissao_percentual / 100), 2);
    INSERT INTO public.comissoes (
      empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status
    ) VALUES (
      v_empresa_id, v_vendedor_id, v_venda_id, v_comissao_percentual, v_total, v_valor_comissao, 'pendente'
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'venda_id', v_venda_id,
    'numero', v_numero,
    'total', v_total,
    'forma_pagamento', CASE WHEN p_condicao = 'parcelado' THEN 'crediario' ELSE lower(p_forma_pagamento) END,
    'rota_id', p_rota_id,
    'rota_numero', v_rota.numero
  );
END;
$$;

-- Permissões RPC vender_na_rua
REVOKE EXECUTE ON FUNCTION public.vender_na_rua(uuid, uuid, jsonb, text, text, jsonb, numeric, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vender_na_rua(uuid, uuid, jsonb, text, text, jsonb, numeric, text, integer, integer, text) TO authenticated, service_role;


-- ============================================================================
-- 2. RPC fechar_rota_acerto
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fechar_rota_acerto(
  p_rota_id uuid,
  p_conferencia jsonb DEFAULT '[]'::jsonb,
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
  v_rota record;
  v_item_estoque record;
  v_conf_item jsonb;
  v_produto_id uuid;
  v_qtd_conferida numeric;
  v_qtd_esperada_retorno numeric;
  v_divergencia numeric := 0;
  v_divergencias jsonb := '[]'::jsonb;
  v_tem_divergencia boolean := false;
  v_prod_nome text;

  -- Totais de cestas
  v_total_carregadas numeric := 0;
  v_total_vendidas numeric := 0;
  v_total_entregues numeric := 0;
  v_total_devolvidas numeric := 0;

  -- Pedidos não entregues / reservas a devolver ao depósito
  v_reservas_devolver_deposito numeric := 0;
  v_devolver_fisico numeric := 0;
  v_devolver_reserva numeric := 0;

  -- Resumo financeiro
  v_totais_por_forma jsonb;
  v_total_recebido numeric(14,2) := 0;
  v_total_parcelado numeric(14,2) := 0;
  v_total_parcelas_recebidas numeric(14,2) := 0;
BEGIN
  -- Validar módulo entregas
  IF NOT public.empresa_tem_modulo('modulo_entregas') THEN
    RAISE EXCEPTION 'O módulo Entregas não está habilitado para esta empresa.';
  END IF;

  -- Identificar usuário
  SELECT u.id, u.empresa_id, u.perfil
  INTO v_usuario_id, v_empresa_id, v_perfil
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true
  LIMIT 1;

  IF v_usuario_id IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  -- Apenas master, admin ou gerente pode fechar rota e fazer acerto
  IF v_perfil NOT IN ('master', 'admin', 'gerente') THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem realizar o fechamento e acerto da rota.';
  END IF;

  -- Travar rota FOR UPDATE
  SELECT * INTO v_rota
  FROM public.rotas
  WHERE id = p_rota_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada.';
  END IF;

  IF v_rota.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'A rota #% não pode ser finalizada pois seu status atual é "%".',
      v_rota.numero, v_rota.status;
  END IF;

  -- 1. FASE DE VALIDAÇÃO: Conferência de cada item carregado
  FOR v_item_estoque IN
    SELECT *
    FROM public.rota_itens_estoque
    WHERE rota_id = p_rota_id AND empresa_id = v_empresa_id
    FOR UPDATE
  LOOP
    -- O que se esperava retornar fisicamente = carregada - (vendida + entregue)
    v_qtd_esperada_retorno := GREATEST(0, v_item_estoque.quantidade_carregada - (
      v_item_estoque.quantidade_vendida + v_item_estoque.quantidade_entregue
    ));

    -- Buscar o que foi informado na conferência para este produto
    v_qtd_conferida := v_qtd_esperada_retorno; -- default é o esperado se não informado
    IF p_conferencia IS NOT NULL AND jsonb_typeof(p_conferencia) = 'array' THEN
      FOR v_conf_item IN SELECT * FROM jsonb_array_elements(p_conferencia)
      LOOP
        IF (v_conf_item->>'produto_id')::uuid = v_item_estoque.produto_id THEN
          v_qtd_conferida := COALESCE((v_conf_item->>'quantidade')::numeric, 0);
        END IF;
      END LOOP;
    END IF;

    IF v_qtd_conferida < 0 THEN
      RAISE EXCEPTION 'Quantidade conferida não pode ser negativa.';
    END IF;

    -- REGRA DE FECHAMENTO: Conferência MAIOR que o esperado
    -- Recusar a operação e registrar a divergência em auditoria_operacoes para impedir criação de estoque fantasma
    IF v_qtd_conferida > v_qtd_esperada_retorno THEN
      SELECT nome INTO v_prod_nome FROM public.produtos WHERE id = v_item_estoque.produto_id;

      INSERT INTO public.auditoria_operacoes (
        empresa_id, usuario_id, tipo_operacao, referencia_id, tabela_referencia, motivo, detalhes
      ) VALUES (
        v_empresa_id, v_usuario_id, 'fechamento_rota_conferencia_excedente', v_rota.id, 'rotas',
        'Tentativa de fechar rota com conferência superior ao estoque esperado do veículo (' || COALESCE(v_prod_nome, 'Produto') || ')',
        jsonb_build_object(
          'rota_numero', v_rota.numero,
          'produto_id', v_item_estoque.produto_id,
          'produto_nome', v_prod_nome,
          'esperado', v_qtd_esperada_retorno,
          'conferido', v_qtd_conferida,
          'excedente', (v_qtd_conferida - v_qtd_esperada_retorno)
        )
      );

      RAISE EXCEPTION 'A quantidade conferida para "%" (% un) é maior que o esperado no veículo (% un). Não é permitido devolver mais do que o esperado no carro.',
        COALESCE(v_prod_nome, 'Produto'), v_qtd_conferida, v_qtd_esperada_retorno;
    END IF;
  END LOOP;

  -- 2. FASE DE EXECUÇÃO: Devolver ao depósito respeitando o esperado e registrando divergências/faltas
  FOR v_item_estoque IN
    SELECT *
    FROM public.rota_itens_estoque
    WHERE rota_id = p_rota_id AND empresa_id = v_empresa_id
    FOR UPDATE
  LOOP
    v_qtd_esperada_retorno := GREATEST(0, v_item_estoque.quantidade_carregada - (
      v_item_estoque.quantidade_vendida + v_item_estoque.quantidade_entregue
    ));

    v_qtd_conferida := v_qtd_esperada_retorno;
    IF p_conferencia IS NOT NULL AND jsonb_typeof(p_conferencia) = 'array' THEN
      FOR v_conf_item IN SELECT * FROM jsonb_array_elements(p_conferencia)
      LOOP
        IF (v_conf_item->>'produto_id')::uuid = v_item_estoque.produto_id THEN
          v_qtd_conferida := COALESCE((v_conf_item->>'quantidade')::numeric, 0);
        END IF;
      END LOOP;
    END IF;

    -- Conferência MENOR que o esperado: registrar a FALTA como divergência
    v_divergencia := v_qtd_conferida - v_qtd_esperada_retorno;
    IF v_divergencia < 0 THEN
      v_tem_divergencia := true;
      SELECT nome INTO v_prod_nome FROM public.produtos WHERE id = v_item_estoque.produto_id;

      v_divergencias := v_divergencias || jsonb_build_object(
        'produto_id', v_item_estoque.produto_id,
        'produto_nome', v_prod_nome,
        'esperado', v_qtd_esperada_retorno,
        'conferido', v_qtd_conferida,
        'falta', abs(v_divergencia)
      );

      INSERT INTO public.auditoria_operacoes (
        empresa_id, usuario_id, tipo_operacao, referencia_id, tabela_referencia, motivo, detalhes
      ) VALUES (
        v_empresa_id, v_usuario_id, 'fechamento_rota_falta', v_rota.id, 'rotas',
        'Falta de cestas apurada na conferência de fechamento da rota #' || v_rota.numero || ' (' || COALESCE(v_prod_nome, 'Produto') || ')',
        jsonb_build_object(
          'rota_numero', v_rota.numero,
          'responsavel_id', v_rota.responsavel_usuario_id,
          'produto_id', v_item_estoque.produto_id,
          'produto_nome', v_prod_nome,
          'esperado', v_qtd_esperada_retorno,
          'conferido', v_qtd_conferida,
          'quantidade_em_falta', abs(v_divergencia)
        )
      );
    END IF;

    -- Calcular quantas cestas deste produto pertencem a pedidos NÃO entregues ou pendentes
    SELECT COALESCE(SUM(ip.quantidade), 0)
    INTO v_reservas_devolver_deposito
    FROM public.rota_pedidos rp
    JOIN public.pedidos p ON p.id = rp.pedido_id
    JOIN public.itens_pedido ip ON ip.pedido_id = p.id AND ip.produto_id = v_item_estoque.produto_id
    WHERE rp.rota_id = p_rota_id
      AND rp.empresa_id = v_empresa_id
      AND rp.status_entrega IN ('pendente', 'nao_entregue')
      AND p.status NOT IN ('faturado', 'cancelado');

    -- O que retorna fisicamente ao depósito é o que foi realmente conferido
    v_devolver_fisico := v_qtd_conferida;
    -- Das unidades conferidas, priorizar restaurar as reservas dos pedidos não entregues
    v_devolver_reserva := LEAST(v_devolver_fisico, v_reservas_devolver_deposito);

    IF v_devolver_fisico > 0 THEN
      UPDATE public.estoques
      SET quantidade = quantidade + v_devolver_fisico,
          quantidade_reservada = quantidade_reservada + v_devolver_reserva,
          updated_at = now()
      WHERE produto_id = v_item_estoque.produto_id AND empresa_id = v_empresa_id;

      -- Registrar movimentação de retorno/transferência de entrada no depósito
      INSERT INTO public.movimentacoes_estoque (
        empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id
      ) VALUES (
        v_empresa_id, v_item_estoque.produto_id, 'transferencia_entrada', v_devolver_fisico,
        'Retorno de Fechamento Rota #' || v_rota.numero ||
          CASE WHEN v_devolver_reserva > 0 THEN ' (' || v_devolver_reserva || ' un reservadas para pedidos)' ELSE '' END,
        v_rota.id, v_usuario_id
      );
    ELSIF v_devolver_reserva > 0 THEN
      -- Se físico conferido foi 0, não há cesta devolvida física nem reserva nova criada no depósito
      NULL;
    END IF;

    -- Atualizar quantidade_devolvida no item da rota
    UPDATE public.rota_itens_estoque
    SET quantidade_devolvida = v_qtd_conferida,
        updated_at = now()
    WHERE id = v_item_estoque.id;

    v_total_carregadas := v_total_carregadas + v_item_estoque.quantidade_carregada;
    v_total_vendidas := v_total_vendidas + v_item_estoque.quantidade_vendida;
    v_total_entregues := v_total_entregues + v_item_estoque.quantidade_entregue;
    v_total_devolvidas := v_total_devolvidas + v_qtd_conferida;
  END LOOP;

  -- 3. Fechar rota com status 'finalizada' e resumo das divergências
  UPDATE public.rotas
  SET status = 'finalizada',
      horario_fechamento = now(),
      divergencia_fechamento = v_divergencias,
      observacoes = COALESCE(p_observacoes, observacoes),
      updated_at = now()
  WHERE id = p_rota_id;

  -- 4. Totalizar financeiro da rota
  WITH vendas_rota AS (
    SELECT id, total, forma_pagamento
    FROM public.vendas
    WHERE empresa_id = v_empresa_id
      AND (
        observacoes ILIKE '%Rota #' || v_rota.numero || '%'
        OR id IN (SELECT venda_id FROM public.rota_pedidos WHERE rota_id = p_rota_id AND venda_id IS NOT NULL)
      )
  ),
  pagamentos_rota AS (
    SELECT vp.forma, SUM(vp.valor) AS total_forma
    FROM public.venda_pagamentos vp
    JOIN vendas_rota vr ON vr.id = vp.venda_id
    WHERE vp.empresa_id = v_empresa_id AND vp.status = 'recebido'
    GROUP BY vp.forma
  )
  SELECT
    COALESCE(jsonb_object_agg(forma, total_forma), '{}'::jsonb),
    COALESCE(SUM(total_forma), 0)
  INTO v_totais_por_forma, v_total_recebido
  FROM pagamentos_rota;

  -- Total parcelado / crediário originado nesta rota
  SELECT COALESCE(SUM(cr.valor), 0)
  INTO v_total_parcelado
  FROM public.contas_receber cr
  WHERE cr.empresa_id = v_empresa_id
    AND cr.venda_id IN (
      SELECT id FROM public.vendas
      WHERE empresa_id = v_empresa_id
        AND (
          observacoes ILIKE '%Rota #' || v_rota.numero || '%'
          OR id IN (SELECT venda_id FROM public.rota_pedidos WHERE rota_id = p_rota_id AND venda_id IS NOT NULL)
        )
    );

  -- Parcelas de devedores recebidas pelo responsável na data da rota
  SELECT COALESCE(SUM(cr.valor_pago), 0)
  INTO v_total_parcelas_recebidas
  FROM public.contas_receber cr
  WHERE cr.empresa_id = v_empresa_id
    AND cr.data_pagamento = v_rota.data
    AND cr.status = 'pago';

  RETURN jsonb_build_object(
    'sucesso', true,
    'rota_id', p_rota_id,
    'numero', v_rota.numero,
    'status', 'finalizada',
    'horario_fechamento', now(),
    'resumo_estoque', jsonb_build_object(
      'carregadas', v_total_carregadas,
      'vendidas', v_total_vendidas,
      'entregues', v_total_entregues,
      'devolvidas', v_total_devolvidas,
      'divergencia', v_divergencias
    ),
    'resumo_financeiro', jsonb_build_object(
      'recebido_por_forma', v_totais_por_forma,
      'total_recebido', v_total_recebido,
      'total_parcelado', v_total_parcelado,
      'parcelas_recebidas_rua', v_total_parcelas_recebidas
    )
  );
END;
$$;

-- Permissões RPC fechar_rota_acerto
REVOKE EXECUTE ON FUNCTION public.fechar_rota_acerto(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_rota_acerto(uuid, jsonb, text) TO authenticated, service_role;
