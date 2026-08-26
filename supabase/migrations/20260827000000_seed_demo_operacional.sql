-- Migration: 20260827000000_seed_demo_operacional.sql
-- Descrição: Seed operacional da empresa Demo (Vendas, Itens de Venda, Comissões, Pedidos, Itens de Pedido, Compras, Itens de Compra, Contas a Pagar, Contas a Receber, Movimentações e atualização de Estoque).
-- Idempotência total com ON CONFLICT (id) DO NOTHING.

DO $$
DECLARE
  DEMO_EMPRESA_ID uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  MASTER_USER_ID uuid := 'ddddddd1-0000-0000-0000-000000000001';
  VENDEDOR_1 uuid := 'ddddddd2-0000-0000-0000-000000000001'; -- Vendedor Demo (3%)
  VENDEDOR_2 uuid := 'ddddddd2-0000-0000-0000-000000000002'; -- Master (5%)
  CLIENTE_1 uuid := 'd0000003-0000-0000-0000-000000000001';
  CLIENTE_2 uuid := 'd0000003-0000-0000-0000-000000000002';
  CLIENTE_3 uuid := 'd0000003-0000-0000-0000-000000000003';
  CLIENTE_4 uuid := 'd0000003-0000-0000-0000-000000000004';
  CLIENTE_5 uuid := 'd0000003-0000-0000-0000-000000000005';
  FORNECEDOR_1 uuid := 'd0000002-0000-0000-0000-000000000001';
  FORNECEDOR_2 uuid := 'd0000002-0000-0000-0000-000000000002';

  -- Produtos Demo
  PROD_1 uuid := 'd0000004-0000-0000-0000-000000000001'; -- Refrigerante Cola 2L (venda 8.90, custo 5.50)
  PROD_2 uuid := 'd0000004-0000-0000-0000-000000000002'; -- Água Mineral 500ml / Coca-Cola Lata (venda 2.50, custo 1.20)
  PROD_3 uuid := 'd0000004-0000-0000-0000-000000000003'; -- Arroz Tipo 1 5kg / Refrigerante 2L (venda 25.90, custo 18.00)
  PROD_4 uuid := 'd0000004-0000-0000-0000-000000000004'; -- Feijão Carioca 1kg / Sabão em Pó 1kg (venda 9.90, custo 6.50)
  PROD_5 uuid := 'd0000004-0000-0000-0000-000000000005'; -- Óleo de Soja 900ml / Detergente 500ml (venda 7.50, custo 4.80)
  PROD_6 uuid := 'd0000004-0000-0000-0000-000000000006'; -- Detergente Líquido 500ml / Água Sanitária 1L (venda 3.50, custo 1.80)
  PROD_7 uuid := 'd0000004-0000-0000-0000-000000000007'; -- Sabão em Pó 1kg / Papel Higiênico 12un (venda 14.90, custo 8.00)
  PROD_8 uuid := 'd0000004-0000-0000-0000-000000000008'; -- Papel Higiênico 4un / Copo Descartável 100un (venda 8.90, custo 5.00)
  PROD_9 uuid := 'd0000004-0000-0000-0000-000000000009'; -- Copo Descartável 100un / Guardanapo 50un (venda 6.90, custo 3.50)
  PROD_10 uuid := 'd0000004-0000-0000-0000-000000000010'; -- Guardanapo 50un / Prato Descartável 10un (venda 4.50, custo 2.00)

BEGIN
  -- 0. Garantir associação dos vendedores nos clientes
  UPDATE public.clientes SET vendedor_id = VENDEDOR_1 WHERE id = CLIENTE_1 AND empresa_id = DEMO_EMPRESA_ID;
  UPDATE public.clientes SET vendedor_id = VENDEDOR_1 WHERE id = CLIENTE_2 AND empresa_id = DEMO_EMPRESA_ID;
  UPDATE public.clientes SET vendedor_id = VENDEDOR_2 WHERE id = CLIENTE_3 AND empresa_id = DEMO_EMPRESA_ID;
  UPDATE public.clientes SET vendedor_id = VENDEDOR_2 WHERE id = CLIENTE_4 AND empresa_id = DEMO_EMPRESA_ID;
  UPDATE public.clientes SET vendedor_id = VENDEDOR_1 WHERE id = CLIENTE_5 AND empresa_id = DEMO_EMPRESA_ID;

  -- =========================================================================
  -- 1. VENDAS (8 vendas)
  -- =========================================================================

  -- Venda 1: #1001, Cliente 1, Vendedor 1 (3%), PIX, finalizada, 3 dias atrás
  -- Itens: P3 (qtd 3, preco 25.90, custo 18.00 = 77.70), P4 (qtd 6, preco 9.90, custo 6.50 = 59.40), P5 (qtd 4, preco 7.50, custo 4.80 = 30.00)
  -- Total: 167.10 | Comissao 3%: 5.01
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, CLIENTE_1, VENDEDOR_1, 1001, 167.10, 0, 167.10, 'pix', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000001', PROD_3, 3, 25.90, 0, 77.70, 18.00),
    ('d1111111-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000001', PROD_4, 6, 9.90, 0, 59.40, 6.50),
    ('d1111111-0000-0000-0000-000000000003', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000001', PROD_5, 4, 7.50, 0, 30.00, 4.80)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, VENDEDOR_1, 'ddddddd3-0000-0000-0000-000000000001', 3.0, 167.10, 5.01, 'pendente', NOW() - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, PROD_3, 'saida', 3, 'Venda #1001', 'ddddddd3-0000-0000-0000-000000000001', MASTER_USER_ID, NOW() - INTERVAL '3 days'),
    ('d3333333-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, PROD_4, 'saida', 6, 'Venda #1001', 'ddddddd3-0000-0000-0000-000000000001', MASTER_USER_ID, NOW() - INTERVAL '3 days'),
    ('d3333333-0000-0000-0000-000000000003', DEMO_EMPRESA_ID, PROD_5, 'saida', 4, 'Venda #1001', 'ddddddd3-0000-0000-0000-000000000001', MASTER_USER_ID, NOW() - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;


  -- Venda 2: #1002, Cliente 2, Vendedor 1 (3%), Dinheiro, finalizada, 5 dias atrás
  -- Itens: P1 (qtd 5, preco 8.90, custo 5.50 = 44.50), P2 (qtd 12, preco 2.50, custo 1.20 = 30.00)
  -- Total: 74.50 | Comissao 3%: 2.24
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, CLIENTE_2, VENDEDOR_1, 1002, 74.50, 0, 74.50, 'dinheiro', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000004', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000002', PROD_1, 5, 8.90, 0, 44.50, 5.50),
    ('d1111111-0000-0000-0000-000000000005', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000002', PROD_2, 12, 2.50, 0, 30.00, 1.20)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, VENDEDOR_1, 'ddddddd3-0000-0000-0000-000000000002', 3.0, 74.50, 2.24, 'pendente', NOW() - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000004', DEMO_EMPRESA_ID, PROD_1, 'saida', 5, 'Venda #1002', 'ddddddd3-0000-0000-0000-000000000002', MASTER_USER_ID, NOW() - INTERVAL '5 days'),
    ('d3333333-0000-0000-0000-000000000005', DEMO_EMPRESA_ID, PROD_2, 'saida', 12, 'Venda #1002', 'ddddddd3-0000-0000-0000-000000000002', MASTER_USER_ID, NOW() - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;


  -- Venda 3: #1003, Cliente 3, Vendedor 2 (5%), Crédito, finalizada, 7 dias atrás
  -- Itens: P6 (qtd 2, preco 3.50, custo 1.80 = 7.00), P7 (qtd 3, preco 14.90, custo 8.00 = 44.70)
  -- Total: 51.70 | Comissao 5%: 2.59
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000003', DEMO_EMPRESA_ID, CLIENTE_3, VENDEDOR_2, 1003, 51.70, 0, 51.70, 'credito', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000006', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000003', PROD_6, 2, 3.50, 0, 7.00, 1.80),
    ('d1111111-0000-0000-0000-000000000007', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000003', PROD_7, 3, 14.90, 0, 44.70, 8.00)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000003', DEMO_EMPRESA_ID, VENDEDOR_2, 'ddddddd3-0000-0000-0000-000000000003', 5.0, 51.70, 2.59, 'pendente', NOW() - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000006', DEMO_EMPRESA_ID, PROD_6, 'saida', 2, 'Venda #1003', 'ddddddd3-0000-0000-0000-000000000003', MASTER_USER_ID, NOW() - INTERVAL '7 days'),
    ('d3333333-0000-0000-0000-000000000007', DEMO_EMPRESA_ID, PROD_7, 'saida', 3, 'Venda #1003', 'ddddddd3-0000-0000-0000-000000000003', MASTER_USER_ID, NOW() - INTERVAL '7 days')
  ON CONFLICT (id) DO NOTHING;


  -- Venda 4: #1004, Cliente 4, Vendedor 2 (5%), PIX, finalizada, 10 dias atrás
  -- Itens: P8 (qtd 4, preco 8.90, custo 5.00 = 35.60), P9 (qtd 5, preco 6.90, custo 3.50 = 34.50)
  -- Total: 70.10 | Comissao 5%: 3.51
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000004', DEMO_EMPRESA_ID, CLIENTE_4, VENDEDOR_2, 1004, 70.10, 0, 70.10, 'pix', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000008', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000004', PROD_8, 4, 8.90, 0, 35.60, 5.00),
    ('d1111111-0000-0000-0000-000000000009', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000004', PROD_9, 5, 6.90, 0, 34.50, 3.50)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000004', DEMO_EMPRESA_ID, VENDEDOR_2, 'ddddddd3-0000-0000-0000-000000000004', 5.0, 70.10, 3.51, 'pendente', NOW() - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000008', DEMO_EMPRESA_ID, PROD_8, 'saida', 4, 'Venda #1004', 'ddddddd3-0000-0000-0000-000000000004', MASTER_USER_ID, NOW() - INTERVAL '10 days'),
    ('d3333333-0000-0000-0000-000000000009', DEMO_EMPRESA_ID, PROD_9, 'saida', 5, 'Venda #1004', 'ddddddd3-0000-0000-0000-000000000004', MASTER_USER_ID, NOW() - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;


  -- Venda 5: #1005, Cliente 5, Vendedor 1 (3%), Débito, finalizada, 12 dias atrás
  -- Itens: P10 (qtd 8, preco 4.50, custo 2.00 = 36.00), P1 (qtd 3, preco 8.90, custo 5.50 = 26.70)
  -- Total: 62.70 | Comissao 3%: 1.88
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000005', DEMO_EMPRESA_ID, CLIENTE_5, VENDEDOR_1, 1005, 62.70, 0, 62.70, 'debito', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000010', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000005', PROD_10, 8, 4.50, 0, 36.00, 2.00),
    ('d1111111-0000-0000-0000-000000000011', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000005', PROD_1, 3, 8.90, 0, 26.70, 5.50)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000005', DEMO_EMPRESA_ID, VENDEDOR_1, 'ddddddd3-0000-0000-0000-000000000005', 3.0, 62.70, 1.88, 'pendente', NOW() - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000010', DEMO_EMPRESA_ID, PROD_10, 'saida', 8, 'Venda #1005', 'ddddddd3-0000-0000-0000-000000000005', MASTER_USER_ID, NOW() - INTERVAL '12 days'),
    ('d3333333-0000-0000-0000-000000000011', DEMO_EMPRESA_ID, PROD_1, 'saida', 3, 'Venda #1005', 'ddddddd3-0000-0000-0000-000000000005', MASTER_USER_ID, NOW() - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;


  -- Venda 6: #1006, Cliente 1, Vendedor 2 (5%), PIX, finalizada, 15 dias atrás
  -- Itens: P2 (qtd 20, preco 2.50, custo 1.20 = 50.00), P3 (qtd 2, preco 25.90, custo 18.00 = 51.80), P6 (qtd 2, preco 3.50, custo 1.80 = 7.00)
  -- Total: 108.80 | Comissao 5%: 5.44
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000006', DEMO_EMPRESA_ID, CLIENTE_1, VENDEDOR_2, 1006, 108.80, 0, 108.80, 'pix', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000012', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000006', PROD_2, 20, 2.50, 0, 50.00, 1.20),
    ('d1111111-0000-0000-0000-000000000013', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000006', PROD_3, 2, 25.90, 0, 51.80, 18.00),
    ('d1111111-0000-0000-0000-000000000014', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000006', PROD_6, 2, 3.50, 0, 7.00, 1.80)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000006', DEMO_EMPRESA_ID, VENDEDOR_2, 'ddddddd3-0000-0000-0000-000000000006', 5.0, 108.80, 5.44, 'pendente', NOW() - INTERVAL '15 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000012', DEMO_EMPRESA_ID, PROD_2, 'saida', 20, 'Venda #1006', 'ddddddd3-0000-0000-0000-000000000006', MASTER_USER_ID, NOW() - INTERVAL '15 days'),
    ('d3333333-0000-0000-0000-000000000013', DEMO_EMPRESA_ID, PROD_3, 'saida', 2, 'Venda #1006', 'ddddddd3-0000-0000-0000-000000000006', MASTER_USER_ID, NOW() - INTERVAL '15 days'),
    ('d3333333-0000-0000-0000-000000000014', DEMO_EMPRESA_ID, PROD_6, 'saida', 2, 'Venda #1006', 'ddddddd3-0000-0000-0000-000000000006', MASTER_USER_ID, NOW() - INTERVAL '15 days')
  ON CONFLICT (id) DO NOTHING;


  -- Venda 7: #1007, Cliente 3, Vendedor 1 (3%), Dinheiro, finalizada, 20 dias atrás
  -- Itens: P7 (qtd 6, preco 14.90, custo 8.00 = 89.40)
  -- Total: 89.40 | Comissao 3%: 2.68
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000007', DEMO_EMPRESA_ID, CLIENTE_3, VENDEDOR_1, 1007, 89.40, 0, 89.40, 'dinheiro', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000015', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000007', PROD_7, 6, 14.90, 0, 89.40, 8.00)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000007', DEMO_EMPRESA_ID, VENDEDOR_1, 'ddddddd3-0000-0000-0000-000000000007', 3.0, 89.40, 2.68, 'pendente', NOW() - INTERVAL '20 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000015', DEMO_EMPRESA_ID, PROD_7, 'saida', 6, 'Venda #1007', 'ddddddd3-0000-0000-0000-000000000007', MASTER_USER_ID, NOW() - INTERVAL '20 days')
  ON CONFLICT (id) DO NOTHING;


  -- Venda 8: #1008, Cliente 4, Vendedor 2 (5%), Crédito, finalizada, 25 dias atrás
  -- Itens: P5 (qtd 10, preco 7.50, custo 4.80 = 75.00), P8 (qtd 3, preco 8.90, custo 5.00 = 26.70), P10 (qtd 5, preco 4.50, custo 2.00 = 22.50)
  -- Total: 124.20 | Comissao 5%: 6.21
  INSERT INTO public.vendas (id, empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total, forma_pagamento, status, created_by, created_at, updated_at)
  VALUES ('ddddddd3-0000-0000-0000-000000000008', DEMO_EMPRESA_ID, CLIENTE_4, VENDEDOR_2, 1008, 124.20, 0, 124.20, 'credito', 'finalizada', MASTER_USER_ID, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_venda (id, empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario)
  VALUES
    ('d1111111-0000-0000-0000-000000000016', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000008', PROD_5, 10, 7.50, 0, 75.00, 4.80),
    ('d1111111-0000-0000-0000-000000000017', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000008', PROD_8, 3, 8.90, 0, 26.70, 5.00),
    ('d1111111-0000-0000-0000-000000000018', DEMO_EMPRESA_ID, 'ddddddd3-0000-0000-0000-000000000008', PROD_10, 5, 4.50, 0, 22.50, 2.00)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.comissoes (id, empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status, created_at)
  VALUES ('d2222222-0000-0000-0000-000000000008', DEMO_EMPRESA_ID, VENDEDOR_2, 'ddddddd3-0000-0000-0000-000000000008', 5.0, 124.20, 6.21, 'pendente', NOW() - INTERVAL '25 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000016', DEMO_EMPRESA_ID, PROD_5, 'saida', 10, 'Venda #1008', 'ddddddd3-0000-0000-0000-000000000008', MASTER_USER_ID, NOW() - INTERVAL '25 days'),
    ('d3333333-0000-0000-0000-000000000017', DEMO_EMPRESA_ID, PROD_8, 'saida', 3, 'Venda #1008', 'ddddddd3-0000-0000-0000-000000000008', MASTER_USER_ID, NOW() - INTERVAL '25 days'),
    ('d3333333-0000-0000-0000-000000000018', DEMO_EMPRESA_ID, PROD_10, 'saida', 5, 'Venda #1008', 'ddddddd3-0000-0000-0000-000000000008', MASTER_USER_ID, NOW() - INTERVAL '25 days')
  ON CONFLICT (id) DO NOTHING;


  -- =========================================================================
  -- 2. PEDIDOS / ORÇAMENTOS (3 pedidos)
  -- =========================================================================

  -- Pedido 1: #2001, Cliente 2, Vendedor 1, status 'pendente', 1 dia atrás
  -- Itens: P1 (qtd 10, preco 8.90 = 89.00), P3 (qtd 5, preco 25.90 = 129.50), P5 (qtd 8, preco 7.50 = 60.00) | Total = 278.50
  INSERT INTO public.pedidos (id, empresa_id, cliente_id, vendedor_id, numero, total, status, observacoes, created_at, updated_at)
  VALUES ('ddddddd4-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, CLIENTE_2, VENDEDOR_1, 2001, 278.50, 'pendente', 'Orçamento para evento', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_pedido (id, empresa_id, pedido_id, produto_id, quantidade, preco_unitario, desconto, subtotal)
  VALUES
    ('d4444444-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, 'ddddddd4-0000-0000-0000-000000000001', PROD_1, 10, 8.90, 0, 89.00),
    ('d4444444-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, 'ddddddd4-0000-0000-0000-000000000001', PROD_3, 5, 25.90, 0, 129.50),
    ('d4444444-0000-0000-0000-000000000003', DEMO_EMPRESA_ID, 'ddddddd4-0000-0000-0000-000000000001', PROD_5, 8, 7.50, 0, 60.00)
  ON CONFLICT (id) DO NOTHING;


  -- Pedido 2: #2002, Cliente 4, Vendedor 2, status 'confirmado', 3 dias atrás
  -- Itens: P2 (qtd 50, preco 2.50 = 125.00), P6 (qtd 4, preco 3.50 = 14.00) | Total = 139.00
  INSERT INTO public.pedidos (id, empresa_id, cliente_id, vendedor_id, numero, total, status, observacoes, created_at, updated_at)
  VALUES ('ddddddd4-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, CLIENTE_4, VENDEDOR_2, 2002, 139.00, 'confirmado', NULL, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_pedido (id, empresa_id, pedido_id, produto_id, quantidade, preco_unitario, desconto, subtotal)
  VALUES
    ('d4444444-0000-0000-0000-000000000004', DEMO_EMPRESA_ID, 'ddddddd4-0000-0000-0000-000000000002', PROD_2, 50, 2.50, 0, 125.00),
    ('d4444444-0000-0000-0000-000000000005', DEMO_EMPRESA_ID, 'ddddddd4-0000-0000-0000-000000000002', PROD_6, 4, 3.50, 0, 14.00)
  ON CONFLICT (id) DO NOTHING;


  -- Pedido 3: #2003, Cliente 1, Vendedor 1, status 'pendente', hoje
  -- Itens: P9 (qtd 3, preco 6.90 = 20.70), P10 (qtd 6, preco 4.50 = 27.00) | Total = 47.70
  INSERT INTO public.pedidos (id, empresa_id, cliente_id, vendedor_id, numero, total, status, observacoes, created_at, updated_at)
  VALUES ('ddddddd4-0000-0000-0000-000000000003', DEMO_EMPRESA_ID, CLIENTE_1, VENDEDOR_1, 2003, 47.70, 'pendente', NULL, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_pedido (id, empresa_id, pedido_id, produto_id, quantidade, preco_unitario, desconto, subtotal)
  VALUES
    ('d4444444-0000-0000-0000-000000000006', DEMO_EMPRESA_ID, 'ddddddd4-0000-0000-0000-000000000003', PROD_9, 3, 6.90, 0, 20.70),
    ('d4444444-0000-0000-0000-000000000007', DEMO_EMPRESA_ID, 'ddddddd4-0000-0000-0000-000000000003', PROD_10, 6, 4.50, 0, 27.00)
  ON CONFLICT (id) DO NOTHING;


  -- =========================================================================
  -- 3. COMPRAS (2 compras)
  -- =========================================================================

  -- Compra 1: #3001, Fornecedor 1 (Coca-Cola Distribuidora), status 'confirmada', a_prazo, data_compra: 10 dias atrás, vencimento: daqui 15 dias
  -- Itens: P1 (qtd 30, preco 5.50 = 165.00), P2 (qtd 50, preco 1.20 = 60.00) | Total = 225.00, valor_pago = 0
  INSERT INTO public.compras (id, empresa_id, fornecedor_id, numero, total, status, forma_pagamento, vencimento, data_compra, valor_pago, created_by, created_at, updated_at)
  VALUES ('ddddddd5-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, FORNECEDOR_1, 3001, 225.00, 'confirmada', 'a_prazo', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE - INTERVAL '10 days', 0, MASTER_USER_ID, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_compra (id, empresa_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
  VALUES
    ('d5555555-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, 'ddddddd5-0000-0000-0000-000000000001', PROD_1, 30, 5.50, 165.00),
    ('d5555555-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, 'ddddddd5-0000-0000-0000-000000000001', PROD_2, 50, 1.20, 60.00)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, fornecedor_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000019', DEMO_EMPRESA_ID, PROD_1, 'entrada', 30, 'Compra #3001', 'ddddddd5-0000-0000-0000-000000000001', FORNECEDOR_1, MASTER_USER_ID, NOW() - INTERVAL '10 days'),
    ('d3333333-0000-0000-0000-000000000020', DEMO_EMPRESA_ID, PROD_2, 'entrada', 50, 'Compra #3001', 'ddddddd5-0000-0000-0000-000000000001', FORNECEDOR_1, MASTER_USER_ID, NOW() - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;


  -- Compra 2: #3002, Fornecedor 2 (Atacadão Alimentos), status 'confirmada', a_vista, data_compra: 5 dias atrás, vencimento: NULL
  -- Itens: P3 (qtd 20, preco 18.00 = 360.00), P4 (qtd 15, preco 6.50 = 97.50), P5 (qtd 25, preco 4.80 = 120.00) | Total = 577.50, valor_pago = 577.50
  INSERT INTO public.compras (id, empresa_id, fornecedor_id, numero, total, status, forma_pagamento, vencimento, data_compra, valor_pago, created_by, created_at, updated_at)
  VALUES ('ddddddd5-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, FORNECEDOR_2, 3002, 577.50, 'confirmada', 'a_vista', NULL, CURRENT_DATE - INTERVAL '5 days', 577.50, MASTER_USER_ID, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.itens_compra (id, empresa_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
  VALUES
    ('d5555555-0000-0000-0000-000000000003', DEMO_EMPRESA_ID, 'ddddddd5-0000-0000-0000-000000000002', PROD_3, 20, 18.00, 360.00),
    ('d5555555-0000-0000-0000-000000000004', DEMO_EMPRESA_ID, 'ddddddd5-0000-0000-0000-000000000002', PROD_4, 15, 6.50, 97.50),
    ('d5555555-0000-0000-0000-000000000005', DEMO_EMPRESA_ID, 'ddddddd5-0000-0000-0000-000000000002', PROD_5, 25, 4.80, 120.00)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, fornecedor_id, usuario_id, created_at)
  VALUES
    ('d3333333-0000-0000-0000-000000000021', DEMO_EMPRESA_ID, PROD_3, 'entrada', 20, 'Compra #3002', 'ddddddd5-0000-0000-0000-000000000002', FORNECEDOR_2, MASTER_USER_ID, NOW() - INTERVAL '5 days'),
    ('d3333333-0000-0000-0000-000000000022', DEMO_EMPRESA_ID, PROD_4, 'entrada', 15, 'Compra #3002', 'ddddddd5-0000-0000-0000-000000000002', FORNECEDOR_2, MASTER_USER_ID, NOW() - INTERVAL '5 days'),
    ('d3333333-0000-0000-0000-000000000023', DEMO_EMPRESA_ID, PROD_5, 'entrada', 25, 'Compra #3002', 'ddddddd5-0000-0000-0000-000000000002', FORNECEDOR_2, MASTER_USER_ID, NOW() - INTERVAL '5 days')
  ON CONFLICT (id) DO NOTHING;


  -- =========================================================================
  -- 4. FINANCEIRO
  -- =========================================================================

  -- 4.1 Contas a Pagar: Compra #3001 (a prazo)
  INSERT INTO public.contas_pagar (id, empresa_id, fornecedor_id, descricao, valor, vencimento, valor_pago, data_pagamento, status, created_at, updated_at)
  VALUES ('eeeeeee1-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, FORNECEDOR_1, 'Compra #3001 — Coca-Cola Distribuidora', 225.00, CURRENT_DATE + INTERVAL '15 days', 0, NULL, 'pendente', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  -- 4.2 Contas a Receber: Venda #1003 e Venda #1008 (a crédito)
  INSERT INTO public.contas_receber (id, empresa_id, cliente_id, venda_id, descricao, valor, vencimento, valor_pago, data_pagamento, status, created_at, updated_at)
  VALUES
    ('eeeeeee2-0000-0000-0000-000000000001', DEMO_EMPRESA_ID, CLIENTE_3, 'ddddddd3-0000-0000-0000-000000000003', 'Venda #1003', 51.70, CURRENT_DATE + INTERVAL '10 days', 0, NULL, 'pendente', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
    ('eeeeeee2-0000-0000-0000-000000000002', DEMO_EMPRESA_ID, CLIENTE_4, 'ddddddd3-0000-0000-0000-000000000008', 'Venda #1008', 124.20, CURRENT_DATE + INTERVAL '20 days', 0, NULL, 'pendente', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days')
  ON CONFLICT (id) DO NOTHING;


  -- =========================================================================
  -- 5. ATUALIZAÇÃO DO SALDO DE ESTOQUE
  -- =========================================================================
  -- P1: Inicial (120) - Venda 2 (5) - Venda 5 (3) + Compra 1 (30) = 142
  -- P2: Inicial (200) - Venda 2 (12) - Venda 6 (20) + Compra 1 (50) = 218
  -- P3: Inicial (80) - Venda 1 (3) - Venda 6 (2) + Compra 2 (20) = 95
  -- P4: Inicial (100) - Venda 1 (6) + Compra 2 (15) = 109
  -- P5: Inicial (150) - Venda 1 (4) - Venda 8 (10) + Compra 2 (25) = 161
  -- P6: Inicial (180) - Venda 3 (2) - Venda 6 (2) = 176
  -- P7: Inicial (90) - Venda 3 (3) - Venda 7 (6) = 81
  -- P8: Inicial (110) - Venda 4 (4) - Venda 8 (3) = 103
  -- P9: Inicial (160) - Venda 4 (5) = 155
  -- P10: Inicial (140) - Venda 5 (8) - Venda 8 (5) = 127
  INSERT INTO public.estoques (empresa_id, produto_id, quantidade, updated_at)
  VALUES
    (DEMO_EMPRESA_ID, PROD_1, 142, NOW()),
    (DEMO_EMPRESA_ID, PROD_2, 218, NOW()),
    (DEMO_EMPRESA_ID, PROD_3, 95, NOW()),
    (DEMO_EMPRESA_ID, PROD_4, 109, NOW()),
    (DEMO_EMPRESA_ID, PROD_5, 161, NOW()),
    (DEMO_EMPRESA_ID, PROD_6, 176, NOW()),
    (DEMO_EMPRESA_ID, PROD_7, 81, NOW()),
    (DEMO_EMPRESA_ID, PROD_8, 103, NOW()),
    (DEMO_EMPRESA_ID, PROD_9, 155, NOW()),
    (DEMO_EMPRESA_ID, PROD_10, 127, NOW())
  ON CONFLICT (empresa_id, produto_id) DO UPDATE SET
    quantidade = EXCLUDED.quantidade,
    updated_at = EXCLUDED.updated_at;

END $$;