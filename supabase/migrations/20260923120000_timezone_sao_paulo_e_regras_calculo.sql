-- Migration: 20260923120000_timezone_sao_paulo_e_regras_calculo.sql
-- Escopo:
-- 1. Helper functions para conversão e truncamento de datas em 'America/Sao_Paulo'
-- 2. Atualizar finalizar_venda e converter_pedido_em_venda para calcular o primeiro dia do mês em America/Sao_Paulo
-- 3. Função canônica de conciliação / fechamento que calcula os indicadores no fuso America/Sao_Paulo

-- 1. Funções utilitárias de fuso horário
CREATE OR REPLACE FUNCTION public.sp_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now() AT TIME ZONE 'America/Sao_Paulo';
$$;

CREATE OR REPLACE FUNCTION public.sp_date(p_ts timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (p_ts AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

CREATE OR REPLACE FUNCTION public.sp_month_start(p_ts timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  -- Retorna o instante UTC exato correspondente a 00:00:00 do primeiro dia do mês em America/Sao_Paulo
  SELECT (date_trunc('month', p_ts AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');
$$;

-- 2. Atualizar finalizar_venda para usar sp_month_start
CREATE OR REPLACE FUNCTION public.finalizar_venda(
  p_cliente_id uuid,
  p_vendedor_id uuid,
  p_itens jsonb,
  p_desconto numeric DEFAULT 0,
  p_forma_pagamento text DEFAULT 'pix'::text,
  p_vencimento date DEFAULT NULL::date,
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

  v_assinatura_id uuid;
  v_limite_vendas_mes integer;
  v_vendas_mes_count integer;
  v_primeiro_dia_mes timestamptz;

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
  v_estoque numeric(14,3);
  v_produto_nome text;

  v_comissao_percentual numeric(5,2) := 0;
  v_valor_comissao numeric(14,2) := 0;

  v_status_ass jsonb;
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

  -- SERIALIZAR OPERAÇÃO DE LIMITE (FOR UPDATE)
  SELECT a.id, p.limite_vendas_mes
  INTO v_assinatura_id, v_limite_vendas_mes
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = v_empresa_id
    AND a.status IN ('trial', 'ativa')
  FOR UPDATE;

  -- 2. VALIDAR PERMISSÃO
  IF v_perfil NOT IN ('master', 'admin', 'gerente', 'vendedor') THEN
    RAISE EXCEPTION 'Usuário não possui permissão para realizar vendas.';
  END IF;

  -- 3. VALIDAR LIMITE DE VENDAS DO PLANO NO MÊS CORRENTE (EM AMERICA/SAO_PAULO)
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

  -- 4. VALIDAR FORMA DE PAGAMENTO
  IF lower(p_forma_pagamento) NOT IN ('dinheiro', 'pix', 'cartao', 'fiado') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  -- 5. VALIDAR CLIENTE
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id = p_cliente_id
        AND c.empresa_id = v_empresa_id
        AND c.ativo = true
    ) THEN
      RAISE EXCEPTION 'Cliente inválido ou pertencente a outra empresa.';
    END IF;
  END IF;

  -- 6. VALIDAR VENDEDOR
  IF p_vendedor_id IS NOT NULL THEN
    SELECT percentual_comissao
    INTO v_comissao_percentual
    FROM public.vendedores
    WHERE id = p_vendedor_id
      AND empresa_id = v_empresa_id
      AND ativo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vendedor inválido ou pertencente a outra empresa.';
    END IF;
  END IF;

  -- 7. VALIDAR ITENS
  IF p_itens IS NULL
     OR jsonb_typeof(p_itens) <> 'array'
     OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A venda precisa possuir pelo menos um produto.';
  END IF;

  -- 8. CALCULAR VENDA E VALIDAR ESTOQUE (COM TRAVA FOR UPDATE)
  FOR v_item IN
    SELECT *
    FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::numeric;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para um dos produtos.';
    END IF;

    -- BUSCAR PRODUTO E PREÇO DIRETAMENTE DO BANCO
    SELECT p.nome, p.preco_venda
    INTO v_produto_nome, v_preco
    FROM public.produtos p
    WHERE p.id = v_produto_id
      AND p.empresa_id = v_empresa_id
      AND p.ativo = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não existe ou pertence a outra empresa.';
    END IF;

    -- BLOQUEAR REGISTRO DE ESTOQUE COM SELECT ... FOR UPDATE
    SELECT quantidade
    INTO v_estoque
    FROM public.estoques
    WHERE produto_id = v_produto_id
      AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_estoque IS NULL THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%": disponível 0, solicitado %.',
        v_produto_nome, v_quantidade;
    END IF;

    IF v_estoque < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%": disponível %, solicitado %.',
        v_produto_nome,
        v_estoque,
        v_quantidade;
    END IF;

    v_subtotal_item := round(v_quantidade * v_preco, 2);
    v_subtotal := v_subtotal + v_subtotal_item;
  END LOOP;

  -- 9. VALIDAR DESCONTO
  IF p_desconto IS NULL THEN
    p_desconto := 0;
  END IF;

  IF p_desconto < 0 THEN
    RAISE EXCEPTION 'Desconto não pode ser negativo.';
  END IF;

  IF p_desconto > v_subtotal THEN
    RAISE EXCEPTION 'Desconto não pode ser maior que o subtotal.';
  END IF;

  v_total := round(v_subtotal - p_desconto, 2);

  -- 10. TRAVA ADVISORY E NUMERAÇÃO DA VENDA POR EMPRESA
  PERFORM pg_advisory_xact_lock(hashtext('empresa_venda_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.vendas
  WHERE empresa_id = v_empresa_id;

  -- 11. CRIAR VENDA COM OVERRIDING SYSTEM VALUE
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
    created_by
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id,
    p_cliente_id,
    p_vendedor_id,
    v_numero,
    v_subtotal,
    p_desconto,
    v_total,
    lower(p_forma_pagamento),
    'finalizada',
    p_observacoes,
    v_usuario_id
  )
  RETURNING id INTO v_venda_id;

  -- 12. INSERIR ITENS + BAIXAR ESTOQUE
  FOR v_item IN
    SELECT *
    FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::numeric;

    SELECT preco_venda, preco_custo
    INTO v_preco, v_preco_custo
    FROM public.produtos
    WHERE id = v_produto_id
      AND empresa_id = v_empresa_id
    FOR UPDATE;

    v_subtotal_item := round(v_quantidade * v_preco, 2);

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
      v_produto_id,
      v_quantidade,
      v_preco,
      0,
      v_subtotal_item,
      v_preco_custo
    );

    UPDATE public.estoques
    SET
      quantidade = quantidade - v_quantidade,
      updated_at = now()
    WHERE produto_id = v_produto_id
      AND empresa_id = v_empresa_id;

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
      v_produto_id,
      'saida',
      v_quantidade,
      'Venda #' || v_numero,
      v_venda_id,
      v_usuario_id
    );
  END LOOP;

  -- 13. FINANCEIRO
  IF lower(p_forma_pagamento) = 'fiado' THEN
    IF p_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Venda fiada precisa possuir um cliente.';
    END IF;

    INSERT INTO public.contas_receber (
      empresa_id,
      cliente_id,
      venda_id,
      descricao,
      valor,
      vencimento,
      status
    )
    VALUES (
      v_empresa_id,
      p_cliente_id,
      v_venda_id,
      'Venda #' || v_numero,
      v_total,
      COALESCE(p_vencimento, public.sp_date(now())),
      'pendente'
    );
  END IF;

  -- 14. COMISSÃO
  IF p_vendedor_id IS NOT NULL AND v_comissao_percentual > 0 THEN
    v_valor_comissao := round(v_total * (v_comissao_percentual / 100), 2);

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
      p_vendedor_id,
      v_venda_id,
      v_comissao_percentual,
      v_total,
      v_valor_comissao,
      'pendente'
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'venda_id', v_venda_id,
    'numero', v_numero,
    'subtotal', v_subtotal,
    'desconto', p_desconto,
    'total', v_total,
    'forma_pagamento', lower(p_forma_pagamento),
    'comissao', v_valor_comissao
  );
END;
$$;

-- 3. Atualizar converter_pedido_em_venda para usar sp_month_start e sp_date
CREATE OR REPLACE FUNCTION public.converter_pedido_em_venda(
  p_pedido_id uuid,
  p_forma_pagamento text DEFAULT 'pix'::text,
  p_vencimento date DEFAULT NULL::date
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
  v_numero bigint;
  v_obs_venda text;

  v_subtotal numeric(14,2) := 0;
  v_desconto numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_qtd_itens integer := 0;

  v_estoque numeric(14,3);
  v_comissao_percentual numeric(5,2) := 0;
  v_valor_comissao numeric(14,2) := 0;

  v_status_ass jsonb;
BEGIN
  -- 0. Validar status da assinatura
  v_status_ass := public.get_status_assinatura();
  IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
  END IF;

  -- 1. Identificar usuário e empresa
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

  -- Serializar operação de limites travando a linha da assinatura
  SELECT a.id, p.limite_vendas_mes
  INTO v_assinatura_id, v_limite_vendas_mes
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = v_empresa_id
    AND a.status IN ('trial', 'ativa')
  FOR UPDATE;

  -- 2. Validar permissão
  IF NOT public.is_vendedor_or_above() THEN
    RAISE EXCEPTION 'Usuário não possui permissão para converter pedidos em venda.';
  END IF;

  -- 3. Validar limite de vendas do plano no mês corrente (EM AMERICA/SAO_PAULO)
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

  -- 4. Validar forma de pagamento
  IF lower(p_forma_pagamento) NOT IN (
    'dinheiro',
    'pix',
    'cartao',
    'fiado'
  ) THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  -- 5. Bloquear e validar pedido
  SELECT *
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_pedido.status = 'cancelado' THEN
    RAISE EXCEPTION 'Não é possível converter um pedido cancelado.';
  END IF;

  IF v_pedido.status <> 'faturado' THEN
    RAISE EXCEPTION 'Apenas pedidos com status "faturado" podem ser convertidos em venda.';
  END IF;

  PERFORM 1
  FROM public.vendas
  WHERE pedido_id = p_pedido_id
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'Este pedido já foi convertido em venda.';
  END IF;

  -- 6. Validar cliente do pedido (se houver)
  IF v_pedido.cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id = v_pedido.cliente_id
        AND c.empresa_id = v_empresa_id
        AND c.ativo = true
    ) THEN
      RAISE EXCEPTION 'Cliente do pedido não está mais ativo ou pertence a outra empresa.';
    END IF;
  END IF;

  -- 7. Validar vendedor do pedido (se houver)
  IF v_pedido.vendedor_id IS NOT NULL THEN
    SELECT percentual_comissao
    INTO v_comissao_percentual
    FROM public.vendedores
    WHERE id = v_pedido.vendedor_id
      AND empresa_id = v_empresa_id
      AND ativo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vendedor do pedido não está mais ativo ou pertence a outra empresa.';
    END IF;
  END IF;

  -- 8. Buscar e validar itens do pedido + Totais + Validar estoque (com FOR UPDATE)
  FOR v_item IN
    SELECT
      ip.id as item_id,
      ip.produto_id,
      ip.quantidade,
      ip.preco_unitario,
      ip.desconto,
      ip.subtotal,
      p.nome as produto_nome,
      p.ativo as produto_ativo,
      p.empresa_id as produto_empresa_id
    FROM public.itens_pedido ip
    JOIN public.produtos p ON ip.produto_id = p.id
    WHERE ip.pedido_id = p_pedido_id
      AND ip.empresa_id = v_empresa_id
  LOOP
    v_qtd_itens := v_qtd_itens + 1;

    IF NOT v_item.produto_ativo OR v_item.produto_empresa_id <> v_empresa_id THEN
      RAISE EXCEPTION 'Produto % não está mais ativo ou pertence a outra empresa.', v_item.produto_nome;
    END IF;

    IF v_item.quantidade IS NULL OR v_item.quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para o produto %.', v_item.produto_nome;
    END IF;

    SELECT quantidade
    INTO v_estoque
    FROM public.estoques
    WHERE produto_id = v_item.produto_id
      AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_estoque IS NULL THEN
      RAISE EXCEPTION 'Produto % não possui estoque cadastrado.', v_item.produto_nome;
    END IF;

    IF v_estoque < v_item.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %. Estoque atual: %, solicitado: %.',
        v_item.produto_nome,
        v_estoque,
        v_item.quantidade;
    END IF;

    v_subtotal := v_subtotal + round(v_item.quantidade * v_item.preco_unitario, 2);
    v_desconto := v_desconto + COALESCE(v_item.desconto, 0);
    v_total := v_total + v_item.subtotal;
  END LOOP;

  IF v_qtd_itens = 0 THEN
    RAISE EXCEPTION 'Pedido não possui itens.';
  END IF;

  -- 9. TRAVA ADVISORY E NUMERAÇÃO DA VENDA POR EMPRESA
  PERFORM pg_advisory_xact_lock(hashtext('empresa_venda_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.vendas
  WHERE empresa_id = v_empresa_id;

  -- 10. Inserir venda com OVERRIDING SYSTEM VALUE
  v_obs_venda := 'Convertido do Pedido #' || v_pedido.numero || COALESCE('. ' || v_pedido.observacoes, '');

  INSERT INTO public.vendas (
    empresa_id,
    cliente_id,
    vendedor_id,
    pedido_id,
    numero,
    subtotal,
    desconto,
    total,
    forma_pagamento,
    status,
    observacoes,
    created_by
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id,
    v_pedido.cliente_id,
    v_pedido.vendedor_id,
    p_pedido_id,
    v_numero,
    v_subtotal,
    v_desconto,
    v_total,
    lower(p_forma_pagamento),
    'finalizada',
    v_obs_venda,
    v_usuario_id
  )
  RETURNING id INTO v_venda_id;

  -- 11. Inserir itens_venda + baixar estoque + movimentações
  FOR v_item IN
    SELECT
      ip.produto_id,
      ip.quantidade,
      ip.preco_unitario,
      ip.desconto,
      ip.subtotal,
      p.preco_custo
    FROM public.itens_pedido ip
    JOIN public.produtos p ON ip.produto_id = p.id
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
      v_item.preco_custo
    );

    UPDATE public.estoques
    SET
      quantidade = quantidade - v_item.quantidade,
      updated_at = now()
    WHERE produto_id = v_item.produto_id
      AND empresa_id = v_empresa_id;

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
      'Venda #' || v_numero,
      v_venda_id,
      v_usuario_id
    );
  END LOOP;

  -- 12. Financeiro (se fiado)
  IF lower(p_forma_pagamento) = 'fiado' THEN
    IF v_pedido.cliente_id IS NULL THEN
      RAISE EXCEPTION 'Venda fiada precisa possuir um cliente.';
    END IF;

    INSERT INTO public.contas_receber (
      empresa_id,
      cliente_id,
      venda_id,
      descricao,
      valor,
      vencimento,
      status
    )
    VALUES (
      v_empresa_id,
      v_pedido.cliente_id,
      v_venda_id,
      'Venda #' || v_numero,
      v_total,
      COALESCE(p_vencimento, public.sp_date(now())),
      'pendente'
    );
  END IF;

  -- 13. Comissão
  IF v_pedido.vendedor_id IS NOT NULL AND v_comissao_percentual > 0 THEN
    v_valor_comissao := round(v_total * (v_comissao_percentual / 100), 2);

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
      v_total,
      v_valor_comissao,
      'pendente'
    );
  END IF;

  -- 14. Atualizar pedido (mantendo status 'faturado')
  UPDATE public.pedidos
  SET
    observacoes = CASE
      WHEN observacoes IS NULL OR observacoes = '' THEN '[Venda #' || v_numero || ']'
      ELSE '[Venda #' || v_numero || '] ' || observacoes
    END,
    updated_at = now()
  WHERE id = p_pedido_id;

  -- 15. Retorno
  RETURN jsonb_build_object(
    'sucesso', true,
    'pedido_id', p_pedido_id,
    'numero_pedido', v_pedido.numero,
    'venda_id', v_venda_id,
    'numero_venda', v_numero,
    'subtotal', v_subtotal,
    'desconto', v_desconto,
    'total', v_total,
    'forma_pagamento', lower(p_forma_pagamento),
    'comissao', COALESCE(v_valor_comissao, 0)
  );
END;
$$;
