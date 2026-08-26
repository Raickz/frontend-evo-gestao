-- Migration: 20260835000000_seed_empresa_demo.sql
-- Descrição: Seed de dados para a empresa Demo (Parte 1: Empresa, Assinatura Trial, Categorias, Fornecedores, Clientes, Produtos, Movimentações e Estoque)

DO $$
DECLARE
  v_demo_empresa_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID;
  v_plano_id UUID := '305cd688-0f66-433d-be0e-dda0caa19275'::UUID; -- Plano Profissional
  v_plano_valor NUMERIC;

  -- Categorias IDs fixos
  v_cat_bebidas UUID := 'd0000001-0000-0000-0000-000000000001'::UUID;
  v_cat_alimentos UUID := 'd0000001-0000-0000-0000-000000000002'::UUID;
  v_cat_limpeza UUID := 'd0000001-0000-0000-0000-000000000003'::UUID;
  v_cat_higiene UUID := 'd0000001-0000-0000-0000-000000000004'::UUID;
  v_cat_descartaveis UUID := 'd0000001-0000-0000-0000-000000000005'::UUID;

  -- Fornecedores IDs fixos
  v_forn_coca UUID := 'd0000002-0000-0000-0000-000000000001'::UUID;
  v_forn_atacadao UUID := 'd0000002-0000-0000-0000-000000000002'::UUID;
  v_forn_limpex UUID := 'd0000002-0000-0000-0000-000000000003'::UUID;

  -- Clientes IDs fixos
  v_cli_bompreco UUID := 'd0000003-0000-0000-0000-000000000001'::UUID;
  v_cli_real UUID := 'd0000003-0000-0000-0000-000000000002'::UUID;
  v_cli_central UUID := 'd0000003-0000-0000-0000-000000000003'::UUID;
  v_cli_saojose UUID := 'd0000003-0000-0000-0000-000000000004'::UUID;
  v_cli_regional UUID := 'd0000003-0000-0000-0000-000000000005'::UUID;

  -- Produtos IDs fixos
  v_prod_refri UUID := 'd0000004-0000-0000-0000-000000000001'::UUID;
  v_prod_agua UUID := 'd0000004-0000-0000-0000-000000000002'::UUID;
  v_prod_arroz UUID := 'd0000004-0000-0000-0000-000000000003'::UUID;
  v_prod_feijao UUID := 'd0000004-0000-0000-0000-000000000004'::UUID;
  v_prod_oleo UUID := 'd0000004-0000-0000-0000-000000000005'::UUID;
  v_prod_detergente UUID := 'd0000004-0000-0000-0000-000000000006'::UUID;
  v_prod_sabao UUID := 'd0000004-0000-0000-0000-000000000007'::UUID;
  v_prod_papel UUID := 'd0000004-0000-0000-0000-000000000008'::UUID;
  v_prod_copo UUID := 'd0000004-0000-0000-0000-000000000009'::UUID;
  v_prod_guardanapo UUID := 'd0000004-0000-0000-0000-000000000010'::UUID;

BEGIN
  -- 1. EMPRESA DEMO
  INSERT INTO public.empresas (id, nome, nome_fantasia, cnpj, status)
  VALUES (v_demo_empresa_id, 'EVO Gestão Demonstração', 'EVO Gestão — Demonstração', '00.000.000/0001-99', 'ativo')
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    nome_fantasia = EXCLUDED.nome_fantasia,
    cnpj = EXCLUDED.cnpj,
    status = EXCLUDED.status;

  -- Obter valor mensal do plano Profissional
  SELECT valor_mensal INTO v_plano_valor FROM public.planos WHERE id = v_plano_id;
  IF v_plano_valor IS NULL THEN
    v_plano_valor := 197.00;
  END IF;

  -- 2. ASSINATURA DEMO (Trial, 14 dias)
  INSERT INTO public.assinaturas (
    empresa_id,
    plano_id,
    valor,
    inicio,
    vencimento,
    status,
    fim_periodo_teste,
    proxima_cobranca
  )
  VALUES (
    v_demo_empresa_id,
    v_plano_id,
    v_plano_valor,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    'trial',
    CURRENT_DATE + INTERVAL '14 days',
    CURRENT_DATE + INTERVAL '14 days'
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    plano_id = EXCLUDED.plano_id,
    valor = EXCLUDED.valor,
    status = EXCLUDED.status,
    fim_periodo_teste = EXCLUDED.fim_periodo_teste,
    vencimento = EXCLUDED.vencimento,
    proxima_cobranca = EXCLUDED.proxima_cobranca,
    updated_at = NOW();

  -- 3. CATEGORIAS (5)
  INSERT INTO public.categorias (id, empresa_id, nome, descricao, ativo)
  VALUES
    (v_cat_bebidas, v_demo_empresa_id, 'Bebidas', 'Bebidas em geral', true),
    (v_cat_alimentos, v_demo_empresa_id, 'Alimentos', 'Alimentos e mantimentos', true),
    (v_cat_limpeza, v_demo_empresa_id, 'Limpeza', 'Produtos de limpeza', true),
    (v_cat_higiene, v_demo_empresa_id, 'Higiene', 'Produtos de higiene pessoal', true),
    (v_cat_descartaveis, v_demo_empresa_id, 'Descartáveis', 'Materiais e copos descartáveis', true)
  ON CONFLICT (empresa_id, nome) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    ativo = EXCLUDED.ativo;

  -- 4. FORNECEDORES (3)
  INSERT INTO public.fornecedores (id, empresa_id, nome, telefone, ativo)
  VALUES
    (v_forn_coca, v_demo_empresa_id, 'Coca-Cola Distribuidora', '(11) 3333-0001', true),
    (v_forn_atacadao, v_demo_empresa_id, 'Atacadão Alimentos', '(11) 3333-0002', true),
    (v_forn_limpex, v_demo_empresa_id, 'Limpex Industrial', '(11) 3333-0003', true)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    ativo = EXCLUDED.ativo;

  -- 5. CLIENTES (5)
  INSERT INTO public.clientes (id, empresa_id, nome, telefone, cidade, estado, ativo)
  VALUES
    (v_cli_bompreco, v_demo_empresa_id, 'Mercado Bom Preço', '(11) 99999-0001', 'São Paulo', 'SP', true),
    (v_cli_real, v_demo_empresa_id, 'Supermercado Real', '(11) 99999-0002', 'Campinas', 'SP', true),
    (v_cli_central, v_demo_empresa_id, 'Distribuidora Central', '(11) 99999-0003', 'Rio de Janeiro', 'RJ', true),
    (v_cli_saojose, v_demo_empresa_id, 'Comércio São José', '(11) 99999-0004', 'Belo Horizonte', 'MG', true),
    (v_cli_regional, v_demo_empresa_id, 'Atacadão Regional', '(11) 99999-0005', 'Curitiba', 'PR', true)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    ativo = EXCLUDED.ativo;

  -- 6. PRODUTOS (10)
  INSERT INTO public.produtos (id, empresa_id, categoria_id, fornecedor_id, nome, unidade, preco_custo, preco_venda, estoque_minimo, ativo)
  VALUES
    (v_prod_refri, v_demo_empresa_id, v_cat_bebidas, v_forn_coca, 'Refrigerante Cola 2L', 'UN', 5.50, 8.90, 10, true),
    (v_prod_agua, v_demo_empresa_id, v_cat_bebidas, v_forn_coca, 'Água Mineral 500ml', 'UN', 1.20, 2.50, 20, true),
    (v_prod_arroz, v_demo_empresa_id, v_cat_alimentos, v_forn_atacadao, 'Arroz Tipo 1 5kg', 'UN', 18.00, 25.90, 15, true),
    (v_prod_feijao, v_demo_empresa_id, v_cat_alimentos, v_forn_atacadao, 'Feijão Carioca 1kg', 'UN', 6.50, 9.90, 15, true),
    (v_prod_oleo, v_demo_empresa_id, v_cat_alimentos, v_forn_atacadao, 'Óleo de Soja 900ml', 'UN', 4.80, 7.50, 20, true),
    (v_prod_detergente, v_demo_empresa_id, v_cat_limpeza, v_forn_limpex, 'Detergente Líquido 500ml', 'UN', 1.80, 3.50, 10, true),
    (v_prod_sabao, v_demo_empresa_id, v_cat_limpeza, v_forn_limpex, 'Sabão em Pó 1kg', 'UN', 8.00, 14.90, 10, true),
    (v_prod_papel, v_demo_empresa_id, v_cat_higiene, v_forn_limpex, 'Papel Higiênico 4un', 'UN', 5.00, 8.90, 15, true),
    (v_prod_copo, v_demo_empresa_id, v_cat_descartaveis, v_forn_limpex, 'Copo Descartável 100un', 'UN', 3.50, 6.90, 10, true),
    (v_prod_guardanapo, v_demo_empresa_id, v_cat_descartaveis, v_forn_limpex, 'Guardanapo 50un', 'UN', 2.00, 4.50, 10, true)
  ON CONFLICT (id) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    fornecedor_id = EXCLUDED.fornecedor_id,
    nome = EXCLUDED.nome,
    unidade = EXCLUDED.unidade,
    preco_custo = EXCLUDED.preco_custo,
    preco_venda = EXCLUDED.preco_venda,
    estoque_minimo = EXCLUDED.estoque_minimo,
    ativo = EXCLUDED.ativo;

  -- 7. MOVIMENTAÇÕES DE ESTOQUE (Entrada inicial para cada produto)
  -- Limpar movimentações iniciais demo anteriores caso existam para idempotência
  DELETE FROM public.movimentacoes_estoque
  WHERE empresa_id = v_demo_empresa_id
    AND motivo = 'Saldo inicial de estoque Demo';

  INSERT INTO public.movimentacoes_estoque (id, empresa_id, produto_id, tipo, quantidade, motivo, fornecedor_id)
  VALUES
    ('d0000005-0000-0000-0000-000000000001'::UUID, v_demo_empresa_id, v_prod_refri, 'entrada', 120, 'Saldo inicial de estoque Demo', v_forn_coca),
    ('d0000005-0000-0000-0000-000000000002'::UUID, v_demo_empresa_id, v_prod_agua, 'entrada', 200, 'Saldo inicial de estoque Demo', v_forn_coca),
    ('d0000005-0000-0000-0000-000000000003'::UUID, v_demo_empresa_id, v_prod_arroz, 'entrada', 80, 'Saldo inicial de estoque Demo', v_forn_atacadao),
    ('d0000005-0000-0000-0000-000000000004'::UUID, v_demo_empresa_id, v_prod_feijao, 'entrada', 100, 'Saldo inicial de estoque Demo', v_forn_atacadao),
    ('d0000005-0000-0000-0000-000000000005'::UUID, v_demo_empresa_id, v_prod_oleo, 'entrada', 150, 'Saldo inicial de estoque Demo', v_forn_atacadao),
    ('d0000005-0000-0000-0000-000000000006'::UUID, v_demo_empresa_id, v_prod_detergente, 'entrada', 180, 'Saldo inicial de estoque Demo', v_forn_limpex),
    ('d0000005-0000-0000-0000-000000000007'::UUID, v_demo_empresa_id, v_prod_sabao, 'entrada', 90, 'Saldo inicial de estoque Demo', v_forn_limpex),
    ('d0000005-0000-0000-0000-000000000008'::UUID, v_demo_empresa_id, v_prod_papel, 'entrada', 110, 'Saldo inicial de estoque Demo', v_forn_limpex),
    ('d0000005-0000-0000-0000-000000000009'::UUID, v_demo_empresa_id, v_prod_copo, 'entrada', 160, 'Saldo inicial de estoque Demo', v_forn_limpex),
    ('d0000005-0000-0000-0000-000000000010'::UUID, v_demo_empresa_id, v_prod_guardanapo, 'entrada', 140, 'Saldo inicial de estoque Demo', v_forn_limpex)
  ON CONFLICT (id) DO UPDATE SET
    produto_id = EXCLUDED.produto_id,
    tipo = EXCLUDED.tipo,
    quantidade = EXCLUDED.quantidade,
    motivo = EXCLUDED.motivo,
    fornecedor_id = EXCLUDED.fornecedor_id;

  -- 8. ESTOQUES (saldo correspondente para cada produto)
  INSERT INTO public.estoques (empresa_id, produto_id, quantidade)
  VALUES
    (v_demo_empresa_id, v_prod_refri, 120),
    (v_demo_empresa_id, v_prod_agua, 200),
    (v_demo_empresa_id, v_prod_arroz, 80),
    (v_demo_empresa_id, v_prod_feijao, 100),
    (v_demo_empresa_id, v_prod_oleo, 150),
    (v_demo_empresa_id, v_prod_detergente, 180),
    (v_demo_empresa_id, v_prod_sabao, 90),
    (v_demo_empresa_id, v_prod_papel, 110),
    (v_demo_empresa_id, v_prod_copo, 160),
    (v_demo_empresa_id, v_prod_guardanapo, 140)
  ON CONFLICT (empresa_id, produto_id) DO UPDATE SET
    quantidade = EXCLUDED.quantidade,
    updated_at = NOW();

END $$;
