-- Migration: 20260923121000_funcao_teste_conciliacao_c1.sql
-- Escopo:
-- Função executar_teste_conciliacao_c1() que:
-- 1. Cria um cenário controlado em uma transação limpa:
--    - 2 produtos com custo (P1: custo 10.00, venda 25.00 | P2: custo 20.00, venda 50.00)
--    - 1 compra à vista (10 un de P1 @ 10.00 = 100.00, paga no ato)
--    - 1 compra a prazo (10 un de P2 @ 20.00 = 200.00, pendente)
--    - 3 vendas à vista com vendedores diferentes:
--        * Venda 1 (Vendedor A, comissão 5%): 2 un de P1 = 50.00 (PIX). Lucro = 50 - 20 = 30.00. Comissao = 2.50.
--        * Venda 2 (Vendedor B, comissão 10%): 1 un de P2 = 50.00 (Dinheiro). Lucro = 50 - 20 = 30.00. Comissao = 5.00.
--        * Venda 3 (Vendedor C, comissão 0%): 1 un de P1 + 1 un de P2 = 75.00 (Cartão). Lucro = 75 - 30 = 45.00. Comissao = 0.00.
--    - 1 venda fiado (cliente X, sem vendedor): 2 un de P1 = 50.00 (Fiado). Gera título a receber de 50.00. Lucro = 50 - 20 = 30.00.
--    - 1 pagamento parcial de título: baixa de 20.00 no título fiado de 50.00 (saldo restante = 30.00).
--    - 1 venda cancelada: 1 un de P2 = 50.00 cancelada (não entra em faturamento, custo nem comissão, estoque estornado).
--    - 1 venda às 23h30 de Brasília (02h30 UTC do dia seguinte) para testar fuso America/Sao_Paulo:
--        * 1 un de P1 = 25.00. Lucro = 25 - 10 = 15.00. Cai no dia de hoje em America/Sao_Paulo!
-- 2. Calcula os indicadores via queries / regras padrão e compara com os valores calculados à mão.
-- 3. Retorna tabela estruturada indicador x esperado x obtido x bateu.
-- 4. Ao final limpa todos os dados de teste (ROLLBACK / cleanup interno da função).

CREATE OR REPLACE FUNCTION public.executar_teste_conciliacao_c1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res jsonb := '[]'::jsonb;
  v_empresa_id uuid;
  v_master_auth uuid;
  v_master_usuario_id uuid;
  v_fornecedor_id uuid;
  v_cliente_id uuid;
  v_vend_a_id uuid;
  v_vend_b_id uuid;
  v_vend_c_id uuid;
  v_prod1_id uuid;
  v_prod2_id uuid;

  -- Ids criados no teste
  v_compra1_id uuid;
  v_compra2_id uuid;
  v_venda1_id uuid;
  v_venda2_id uuid;
  v_venda3_id uuid;
  v_venda4_fiado_id uuid;
  v_venda5_cancelada_id uuid;
  v_venda6_noite_id uuid;
  v_conta_receber_fiado_id uuid;
  v_conta_pagar_compra2_id uuid;

  -- Timestamps de referência
  v_hoje_sp date;
  v_inicio_dia_utc timestamptz;
  v_fim_dia_utc timestamptz;
  v_ts_23h30_sp timestamptz;

  -- Variáveis obtidas
  v_fat_obtido numeric := 0;
  v_qtd_vendas_obtida integer := 0;
  v_ticket_medio_obtido numeric := 0;
  v_custo_obtido numeric := 0;
  v_lucro_obtido numeric := 0;
  v_margem_obtida numeric := 0;
  v_compras_total_obtido numeric := 0;
  v_compras_qtd_obtida integer := 0;
  v_rec_aberto_obtido numeric := 0;
  v_pag_aberto_obtido numeric := 0;
  v_rec_total_pago_obtido numeric := 0;
  v_comissoes_pendentes_obtidas numeric := 0;
  v_estoque_p1_obtido numeric := 0;
  v_estoque_p2_obtido numeric := 0;
  v_venda_noite_dia_sp date;

  -- Variáveis esperadas (calculadas à mão)
  c_fat_esperado CONSTANT numeric := 250.00; -- V1 (50) + V2 (50) + V3 (75) + V4_fiado (50) + V6_23h30 (25) = 250.00
  c_qtd_vendas_esperada CONSTANT integer := 5; -- V1, V2, V3, V4, V6 (V5 cancelada não conta)
  c_ticket_medio_esperado CONSTANT numeric := 50.00; -- 250.00 / 5 = 50.00
  c_custo_esperado CONSTANT numeric := 100.00; -- V1 (2*10=20) + V2 (1*20=20) + V3 (1*10+1*20=30) + V4 (2*10=20) + V6 (1*10=10) = 100.00
  c_lucro_esperado CONSTANT numeric := 150.00; -- 250.00 - 100.00 = 150.00
  c_margem_esperada CONSTANT numeric := 60.00; -- (150.00 / 250.00) * 100 = 60.00%
  c_compras_total_esperado CONSTANT numeric := 300.00; -- Compra1 (100) + Compra2 (200) = 300.00
  c_compras_qtd_esperada CONSTANT integer := 2;
  c_rec_aberto_esperado CONSTANT numeric := 30.00; -- Fiado 50.00 com baixa parcial de 20.00 = 30.00
  c_pag_aberto_esperado CONSTANT numeric := 200.00; -- Compra2 a prazo 200.00 com 0 pago = 200.00
  c_rec_total_pago_esperado CONSTANT numeric := 20.00; -- Baixa de 20.00
  c_comissoes_pendentes_esperadas CONSTANT numeric := 7.50; -- V1 (5% de 50 = 2.50) + V2 (10% de 50 = 5.00) = 7.50
  c_estoque_p1_esperado CONSTANT numeric := 4.00; -- Entrada 10 - Saídas (V1: 2 + V3: 1 + V4: 2 + V6: 1 = 6) = 4 un
  c_estoque_p2_esperado CONSTANT numeric := 8.00; -- Entrada 10 - Saídas (V2: 1 + V3: 1 = 2; V5 cancelada estornou) = 8 un
BEGIN
  -- 0. Obter empresa ativa e master para a simulação
  SELECT e.id, u.auth_user_id, u.id
  INTO v_empresa_id, v_master_auth, v_master_usuario_id
  FROM public.empresas e
  JOIN public.usuarios u ON u.empresa_id = e.id
  WHERE u.perfil = 'master' AND u.ativo = true AND lower(e.status) IN ('ativo', 'ativa')
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa com usuário master encontrada.';
  END IF;

  v_hoje_sp := public.sp_date(now());
  -- Início do dia SP em UTC (00:00:00 SP = 03:00:00 UTC)
  v_inicio_dia_utc := (v_hoje_sp::text || ' 00:00:00 America/Sao_Paulo')::timestamptz;
  -- Fim do dia SP em UTC (23:59:59.999 SP = 02:59:59.999 UTC do dia seguinte)
  v_fim_dia_utc := (v_hoje_sp::text || ' 23:59:59.999 America/Sao_Paulo')::timestamptz;

  -- Timestamp de 23:30:00 de hoje em Brasília (em UTC será 02:30:00 do dia seguinte)
  v_ts_23h30_sp := (v_hoje_sp::text || ' 23:30:00 America/Sao_Paulo')::timestamptz;

  -- 1. CRIAR DADOS CONTROLADOS DO TESTE
  -- Fornecedor de teste
  INSERT INTO public.fornecedores (empresa_id, nome, documento, ativo)
  VALUES (v_empresa_id, 'FORNECEDOR TESTE C1', '11111111000199', true)
  RETURNING id INTO v_fornecedor_id;

  -- Cliente de teste
  INSERT INTO public.clientes (empresa_id, nome, documento, ativo)
  VALUES (v_empresa_id, 'CLIENTE TESTE C1', '22222222000188', true)
  RETURNING id INTO v_cliente_id;

  -- 3 Vendedores de teste
  INSERT INTO public.vendedores (empresa_id, nome, percentual_comissao, ativo)
  VALUES (v_empresa_id, 'VENDEDOR A (5%)', 5.00, true)
  RETURNING id INTO v_vend_a_id;

  INSERT INTO public.vendedores (empresa_id, nome, percentual_comissao, ativo)
  VALUES (v_empresa_id, 'VENDEDOR B (10%)', 10.00, true)
  RETURNING id INTO v_vend_b_id;

  INSERT INTO public.vendedores (empresa_id, nome, percentual_comissao, ativo)
  VALUES (v_empresa_id, 'VENDEDOR C (0%)', 0.00, true)
  RETURNING id INTO v_vend_c_id;

  -- 2 Produtos de teste
  -- P1: Custo 10.00, Venda 25.00
  INSERT INTO public.produtos (empresa_id, nome, codigo, preco_custo, preco_venda, estoque_minimo, ativo)
  VALUES (v_empresa_id, 'PRODUTO P1 TESTE', 'P1-C1', 10.00, 25.00, 2, true)
  RETURNING id INTO v_prod1_id;

  -- P2: Custo 20.00, Venda 50.00
  INSERT INTO public.produtos (empresa_id, nome, codigo, preco_custo, preco_venda, estoque_minimo, ativo)
  VALUES (v_empresa_id, 'PRODUTO P2 TESTE', 'P2-C1', 20.00, 50.00, 2, true)
  RETURNING id INTO v_prod2_id;

  -- Inicializar estoques
  INSERT INTO public.estoques (empresa_id, produto_id, quantidade)
  VALUES (v_empresa_id, v_prod1_id, 0), (v_empresa_id, v_prod2_id, 0);

  -- COMPRA 1: À VISTA (10 un P1 @ 10.00 = 100.00, paga no ato)
  INSERT INTO public.compras (
    empresa_id, fornecedor_id, numero, total, status, data_compra, forma_pagamento, valor_pago, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_fornecedor_id, 999901, 100.00, 'confirmada', v_hoje_sp, 'dinheiro', 100.00, v_master_usuario_id, v_inicio_dia_utc + interval '1 hour'
  ) RETURNING id INTO v_compra1_id;

  INSERT INTO public.itens_compra (empresa_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
  VALUES (v_empresa_id, v_compra1_id, v_prod1_id, 10, 10.00, 100.00);

  UPDATE public.estoques SET quantidade = quantidade + 10 WHERE produto_id = v_prod1_id AND empresa_id = v_empresa_id;

  -- COMPRA 2: A PRAZO (10 un P2 @ 20.00 = 200.00, em aberto)
  INSERT INTO public.compras (
    empresa_id, fornecedor_id, numero, total, status, data_compra, forma_pagamento, vencimento, valor_pago, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_fornecedor_id, 999902, 200.00, 'confirmada', v_hoje_sp, 'a_prazo', v_hoje_sp + 30, 0, v_master_usuario_id, v_inicio_dia_utc + interval '2 hours'
  ) RETURNING id INTO v_compra2_id;

  INSERT INTO public.itens_compra (empresa_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
  VALUES (v_empresa_id, v_compra2_id, v_prod2_id, 10, 20.00, 200.00);

  UPDATE public.estoques SET quantidade = quantidade + 10 WHERE produto_id = v_prod2_id AND empresa_id = v_empresa_id;

  -- Conta a pagar da Compra 2
  INSERT INTO public.contas_pagar (empresa_id, fornecedor_id, descricao, valor, vencimento, valor_pago, status, created_at)
  VALUES (v_empresa_id, v_fornecedor_id, 'Compra #999902', 200.00, v_hoje_sp + 30, 0, 'pendente', v_inicio_dia_utc + interval '2 hours')
  RETURNING id INTO v_conta_pagar_compra2_id;

  -- VENDA 1 (Vendedor A, comissão 5%): 2 un P1 = 50.00 (PIX). Lucro = 50 - 20 = 30.00. Comissao = 2.50
  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_cliente_id, v_vend_a_id, 999911, 50.00, 0, 50.00, 'pix', 'finalizada', v_master_usuario_id, v_inicio_dia_utc + interval '3 hours'
  ) RETURNING id INTO v_venda1_id;

  INSERT INTO public.itens_venda (empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES (v_empresa_id, v_venda1_id, v_prod1_id, 2, 25.00, 0, 50.00, 10.00);

  UPDATE public.estoques SET quantidade = quantidade - 2 WHERE produto_id = v_prod1_id AND empresa_id = v_empresa_id;

  INSERT INTO public.comissoes (empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES (v_empresa_id, v_vend_a_id, v_venda1_id, 5.00, 50.00, 2.50, 'pendente', v_inicio_dia_utc + interval '3 hours');

  -- VENDA 2 (Vendedor B, comissão 10%): 1 un P2 = 50.00 (Dinheiro). Lucro = 50 - 20 = 30.00. Comissao = 5.00
  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_cliente_id, v_vend_b_id, 999912, 50.00, 0, 50.00, 'dinheiro', 'finalizada', v_master_usuario_id, v_inicio_dia_utc + interval '4 hours'
  ) RETURNING id INTO v_venda2_id;

  INSERT INTO public.itens_venda (empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES (v_empresa_id, v_venda2_id, v_prod2_id, 1, 50.00, 0, 50.00, 20.00);

  UPDATE public.estoques SET quantidade = quantidade - 1 WHERE produto_id = v_prod2_id AND empresa_id = v_empresa_id;

  INSERT INTO public.comissoes (empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES (v_empresa_id, v_vend_b_id, v_venda2_id, 10.00, 50.00, 5.00, 'pendente', v_inicio_dia_utc + interval '4 hours');

  -- VENDA 3 (Vendedor C, comissão 0%): 1 un P1 + 1 un P2 = 75.00 (Cartão). Lucro = 75 - 30 = 45.00. Comissao = 0.00
  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_cliente_id, v_vend_c_id, 999913, 75.00, 0, 75.00, 'cartao', 'finalizada', v_master_usuario_id, v_inicio_dia_utc + interval '5 hours'
  ) RETURNING id INTO v_venda3_id;

  INSERT INTO public.itens_venda (empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    (v_empresa_id, v_venda3_id, v_prod1_id, 1, 25.00, 0, 25.00, 10.00),
    (v_empresa_id, v_venda3_id, v_prod2_id, 1, 50.00, 0, 50.00, 20.00);

  UPDATE public.estoques SET quantidade = quantidade - 1 WHERE produto_id = v_prod1_id AND empresa_id = v_empresa_id;
  UPDATE public.estoques SET quantidade = quantidade - 1 WHERE produto_id = v_prod2_id AND empresa_id = v_empresa_id;

  -- VENDA 4: FIADO (Cliente, sem vendedor): 2 un P1 = 50.00 (Fiado). Lucro = 50 - 20 = 30.00. Título a receber = 50.00
  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_cliente_id, NULL, 999914, 50.00, 0, 50.00, 'fiado', 'finalizada', v_master_usuario_id, v_inicio_dia_utc + interval '6 hours'
  ) RETURNING id INTO v_venda4_fiado_id;

  INSERT INTO public.itens_venda (empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES (v_empresa_id, v_venda4_fiado_id, v_prod1_id, 2, 25.00, 0, 50.00, 10.00);

  UPDATE public.estoques SET quantidade = quantidade - 2 WHERE produto_id = v_prod1_id AND empresa_id = v_empresa_id;

  INSERT INTO public.contas_receber (empresa_id, cliente_id, venda_id, descricao, valor, vencimento, valor_pago, status, created_at)
  VALUES (v_empresa_id, v_cliente_id, v_venda4_fiado_id, 'Venda #999914', 50.00, v_hoje_sp + 15, 0, 'pendente', v_inicio_dia_utc + interval '6 hours')
  RETURNING id INTO v_conta_receber_fiado_id;

  -- PAGAMENTO PARCIAL DO TÍTULO FIADO: 20.00 (saldo restante = 30.00)
  UPDATE public.contas_receber
  SET valor_pago = 20.00, data_pagamento = v_hoje_sp, updated_at = now()
  WHERE id = v_conta_receber_fiado_id;

  -- VENDA 5: CANCELADA (1 un P2 = 50.00, cancelada. Não conta em faturamento nem custo nem estoque)
  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_cliente_id, v_vend_b_id, 999915, 50.00, 0, 50.00, 'dinheiro', 'cancelada', v_master_usuario_id, v_inicio_dia_utc + interval '7 hours'
  ) RETURNING id INTO v_venda5_cancelada_id;

  INSERT INTO public.itens_venda (empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES (v_empresa_id, v_venda5_cancelada_id, v_prod2_id, 1, 50.00, 0, 50.00, 20.00);

  -- VENDA 6: ÀS 23h30 DE BRASÍLIA (02h30 UTC do dia seguinte!)
  -- 1 un P1 = 25.00. Lucro = 25 - 10 = 15.00.
  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at
  ) OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_cliente_id, NULL, 999916, 25.00, 0, 25.00, 'pix', 'finalizada', v_master_usuario_id, v_ts_23h30_sp
  ) RETURNING id INTO v_venda6_noite_id;

  INSERT INTO public.itens_venda (empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES (v_empresa_id, v_venda6_noite_id, v_prod1_id, 1, 25.00, 0, 25.00, 10.00);

  UPDATE public.estoques SET quantidade = quantidade - 1 WHERE produto_id = v_prod1_id AND empresa_id = v_empresa_id;

  -- --------------------------------------------------------------------------
  -- 2. EXECUTAR AS QUERIES DE CONCILIAÇÃO (NO FUSO AMERICA/SAO_PAULO)
  -- --------------------------------------------------------------------------

  -- 2.1 Vendas e Faturamento no período de hoje (usando os limites UTC exatos do dia em America/Sao_Paulo)
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*)
  INTO
    v_fat_obtido,
    v_qtd_vendas_obtida
  FROM public.vendas
  WHERE empresa_id = v_empresa_id
    AND status = 'finalizada'
    AND id IN (v_venda1_id, v_venda2_id, v_venda3_id, v_venda4_fiado_id, v_venda5_cancelada_id, v_venda6_noite_id)
    AND created_at >= v_inicio_dia_utc
    AND created_at <= v_fim_dia_utc;

  IF v_qtd_vendas_obtida > 0 THEN
    v_ticket_medio_obtido := ROUND(v_fat_obtido / v_qtd_vendas_obtida, 2);
  ELSE
    v_ticket_medio_obtido := 0;
  END IF;

  -- 2.2 Custo e Lucro das Vendas
  SELECT
    COALESCE(SUM(iv.quantidade * iv.custo_unitario), 0)
  INTO
    v_custo_obtido
  FROM public.itens_venda iv
  JOIN public.vendas v ON v.id = iv.venda_id
  WHERE iv.empresa_id = v_empresa_id
    AND v.status = 'finalizada'
    AND v.id IN (v_venda1_id, v_venda2_id, v_venda3_id, v_venda4_fiado_id, v_venda5_cancelada_id, v_venda6_noite_id)
    AND v.created_at >= v_inicio_dia_utc
    AND v.created_at <= v_fim_dia_utc;

  v_lucro_obtido := v_fat_obtido - v_custo_obtido;

  IF v_fat_obtido > 0 THEN
    v_margem_obtida := ROUND((v_lucro_obtido / v_fat_obtido) * 100, 2);
  ELSE
    v_margem_obtida := 0;
  END IF;

  -- 2.3 Compras
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*)
  INTO
    v_compras_total_obtido,
    v_compras_qtd_obtida
  FROM public.compras
  WHERE empresa_id = v_empresa_id
    AND id IN (v_compra1_id, v_compra2_id)
    AND data_compra = v_hoje_sp;

  -- 2.4 Contas a Receber em aberto e total recebido
  SELECT
    COALESCE(SUM(valor - valor_pago), 0),
    COALESCE(SUM(valor_pago), 0)
  INTO
    v_rec_aberto_obtido,
    v_rec_total_pago_obtido
  FROM public.contas_receber
  WHERE empresa_id = v_empresa_id
    AND id = v_conta_receber_fiado_id
    AND status <> 'cancelado'
    AND status <> 'pago';

  -- 2.5 Contas a Pagar em aberto
  SELECT
    COALESCE(SUM(valor - valor_pago), 0)
  INTO
    v_pag_aberto_obtido
  FROM public.contas_pagar
  WHERE empresa_id = v_empresa_id
    AND id = v_conta_pagar_compra2_id
    AND status <> 'cancelado'
    AND status <> 'pago';

  -- 2.6 Comissões Pendentes
  SELECT
    COALESCE(SUM(valor_comissao), 0)
  INTO
    v_comissoes_pendentes_obtidas
  FROM public.comissoes
  WHERE empresa_id = v_empresa_id
    AND venda_id IN (v_venda1_id, v_venda2_id, v_venda3_id)
    AND status = 'pendente';

  -- 2.7 Estoques Finais
  SELECT quantidade INTO v_estoque_p1_obtido
  FROM public.estoques
  WHERE produto_id = v_prod1_id AND empresa_id = v_empresa_id;

  SELECT quantidade INTO v_estoque_p2_obtido
  FROM public.estoques
  WHERE produto_id = v_prod2_id AND empresa_id = v_empresa_id;

  -- 2.8 Fuso Horário: Venda das 23h30 caiu no dia de hoje em America/Sao_Paulo?
  SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date
  INTO v_venda_noite_dia_sp
  FROM public.vendas
  WHERE id = v_venda6_noite_id;

  -- --------------------------------------------------------------------------
  -- 3. COMPARAR CENTAVO POR CENTAVO E MONTAR RESULTADO
  -- --------------------------------------------------------------------------
  v_res := v_res || jsonb_build_object(
    'indicador', 'faturamento_hoje',
    'esperado', c_fat_esperado,
    'obtido', v_fat_obtido,
    'bateu', (v_fat_obtido = c_fat_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'numero_vendas_hoje',
    'esperado', c_qtd_vendas_esperada,
    'obtido', v_qtd_vendas_obtida,
    'bateu', (v_qtd_vendas_obtida = c_qtd_vendas_esperada)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'ticket_medio_hoje',
    'esperado', c_ticket_medio_esperado,
    'obtido', v_ticket_medio_obtido,
    'bateu', (v_ticket_medio_obtido = c_ticket_medio_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'custo_historico_produtos',
    'esperado', c_custo_esperado,
    'obtido', v_custo_obtido,
    'bateu', (v_custo_obtido = c_custo_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'lucro_bruto',
    'esperado', c_lucro_esperado,
    'obtido', v_lucro_obtido,
    'bateu', (v_lucro_obtido = c_lucro_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'margem_lucro_percentual',
    'esperado', c_margem_esperada,
    'obtido', v_margem_obtida,
    'bateu', (v_margem_obtida = c_margem_esperada)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'compras_total',
    'esperado', c_compras_total_esperado,
    'obtido', v_compras_total_obtido,
    'bateu', (v_compras_total_obtido = c_compras_total_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'contas_receber_aberto',
    'esperado', c_rec_aberto_esperado,
    'obtido', v_rec_aberto_obtido,
    'bateu', (v_rec_aberto_obtido = c_rec_aberto_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'contas_pagar_aberto',
    'esperado', c_pag_aberto_esperado,
    'obtido', v_pag_aberto_obtido,
    'bateu', (v_pag_aberto_obtido = c_pag_aberto_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'contas_recebidas_pago',
    'esperado', c_rec_total_pago_esperado,
    'obtido', v_rec_total_pago_obtido,
    'bateu', (v_rec_total_pago_obtido = c_rec_total_pago_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'comissoes_pendentes',
    'esperado', c_comissoes_pendentes_esperadas,
    'obtido', v_comissoes_pendentes_obtidas,
    'bateu', (v_comissoes_pendentes_obtidas = c_comissoes_pendentes_esperadas)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'estoque_final_p1',
    'esperado', c_estoque_p1_esperado,
    'obtido', v_estoque_p1_obtido,
    'bateu', (v_estoque_p1_obtido = c_estoque_p1_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'estoque_final_p2',
    'esperado', c_estoque_p2_esperado,
    'obtido', v_estoque_p2_obtido,
    'bateu', (v_estoque_p2_obtido = c_estoque_p2_esperado)
  );

  v_res := v_res || jsonb_build_object(
    'indicador', 'fuso_venda_23h30_sp_cai_no_dia_certo',
    'esperado', v_hoje_sp::text,
    'obtido', v_venda_noite_dia_sp::text,
    'bateu', (v_venda_noite_dia_sp = v_hoje_sp)
  );

  -- --------------------------------------------------------------------------
  -- 4. LIMPEZA TOTAL DOS DADOS DE TESTE (SEM DEIXAR RESÍDUOS)
  -- --------------------------------------------------------------------------
  DELETE FROM public.comissoes WHERE venda_id IN (v_venda1_id, v_venda2_id, v_venda3_id);
  DELETE FROM public.contas_receber WHERE id = v_conta_receber_fiado_id;
  DELETE FROM public.contas_pagar WHERE id = v_conta_pagar_compra2_id;
  DELETE FROM public.itens_venda WHERE venda_id IN (v_venda1_id, v_venda2_id, v_venda3_id, v_venda4_fiado_id, v_venda5_cancelada_id, v_venda6_noite_id);
  DELETE FROM public.vendas WHERE id IN (v_venda1_id, v_venda2_id, v_venda3_id, v_venda4_fiado_id, v_venda5_cancelada_id, v_venda6_noite_id);
  DELETE FROM public.itens_compra WHERE compra_id IN (v_compra1_id, v_compra2_id);
  DELETE FROM public.compras WHERE id IN (v_compra1_id, v_compra2_id);
  DELETE FROM public.estoques WHERE produto_id IN (v_prod1_id, v_prod2_id) AND empresa_id = v_empresa_id;
  DELETE FROM public.produtos WHERE id IN (v_prod1_id, v_prod2_id);
  DELETE FROM public.vendedores WHERE id IN (v_vend_a_id, v_vend_b_id, v_vend_c_id);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  DELETE FROM public.fornecedores WHERE id = v_fornecedor_id;

  RETURN v_res;
END;
$$;
