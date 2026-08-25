-- Migration: Atualização de Planos, Assinaturas e Assinatura Trial para EvoGestão

-- 1. ALTER TABLE planos
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS periodo_teste_dias INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_vendedores INTEGER,
  ADD COLUMN IF NOT EXISTS limite_produtos INTEGER,
  ADD COLUMN IF NOT EXISTS limite_clientes INTEGER,
  ADD COLUMN IF NOT EXISTS limite_vendas_mes INTEGER,
  ADD COLUMN IF NOT EXISTS recursos JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Constraint unique em slug (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planos_slug_key'
  ) THEN
    ALTER TABLE public.planos ADD CONSTRAINT planos_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Inserir / Atualizar os 3 planos padrão
INSERT INTO public.planos (
  slug,
  nome,
  descricao,
  valor_mensal,
  periodo_teste_dias,
  limite_usuarios,
  limite_vendedores,
  limite_produtos,
  limite_clientes,
  limite_vendas_mes,
  recursos,
  ordem,
  ativo
) VALUES
(
  'basico',
  'Básico',
  'Ideal para pequenas distribuidoras iniciando a gestão.',
  97.00,
  14,
  2,
  1,
  100,
  50,
  100,
  '["Gestão de produtos","Controle de estoque","Vendas e pedidos","Financeiro básico","Relatórios essenciais","1 vendedor"]'::jsonb,
  1,
  true
),
(
  'profissional',
  'Profissional',
  'Para distribuidoras em crescimento que precisam de mais recursos.',
  197.00,
  14,
  5,
  3,
  1000,
  500,
  500,
  '["Tudo do Básico","Múltiplos vendedores","Comissões","Compras e fornecedores","Relatórios avançados","Relatório de lucro","Upload de logo"]'::jsonb,
  2,
  true
),
(
  'empresarial',
  'Empresarial',
  'Para grandes distribuidoras com operações complexas.',
  397.00,
  14,
  20,
  10,
  10000,
  5000,
  5000,
  '["Tudo do Profissional","Vendedores ilimitados","Produtos ilimitados","Clientes ilimitados","Suporte prioritário","API de integração"]'::jsonb,
  3,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  valor_mensal = EXCLUDED.valor_mensal,
  periodo_teste_dias = EXCLUDED.periodo_teste_dias,
  limite_usuarios = EXCLUDED.limite_usuarios,
  limite_vendedores = EXCLUDED.limite_vendedores,
  limite_produtos = EXCLUDED.limite_produtos,
  limite_clientes = EXCLUDED.limite_clientes,
  limite_vendas_mes = EXCLUDED.limite_vendas_mes,
  recursos = EXCLUDED.recursos,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo,
  updated_at = now();

-- 2. ALTER TABLE assinaturas
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS fim_periodo_teste DATE,
  ADD COLUMN IF NOT EXISTS proxima_cobranca DATE,
  ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;

-- Atualizar CHECK constraint de status em assinaturas para incluir 'trial'
ALTER TABLE public.assinaturas DROP CONSTRAINT IF EXISTS assinaturas_status_check;
ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_status_check
  CHECK (status = ANY (ARRAY['trial'::text, 'ativa'::text, 'pendente'::text, 'atrasada'::text, 'cancelada'::text, 'bloqueada'::text]));

-- 3. Inserir assinatura trial apenas para a empresa real EvoGestão (id: 49a8bde6-e5cf-4809-9330-6739baf2fb53 ou nome_fantasia/nome EvoGestão)
DO $$
DECLARE
  v_empresa_id UUID;
  v_plano_id UUID;
  v_valor_mensal NUMERIC;
  v_dias_teste INTEGER;
BEGIN
  -- Localizar empresa EvoGestão
  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE id = '49a8bde6-e5cf-4809-9330-6739baf2fb53'::uuid
     OR nome_fantasia ILIKE '%EvoGestão%'
     OR nome ILIKE '%EvoGestão%'
  LIMIT 1;

  -- Localizar plano profissional
  SELECT id, valor_mensal, periodo_teste_dias
  INTO v_plano_id, v_valor_mensal, v_dias_teste
  FROM public.planos
  WHERE slug = 'profissional' AND ativo = true
  LIMIT 1;

  -- Inserir se encontrar a empresa e se ela ainda não tiver assinatura
  IF v_empresa_id IS NOT NULL AND v_plano_id IS NOT NULL THEN
    INSERT INTO public.assinaturas (
      empresa_id,
      plano_id,
      valor,
      inicio,
      fim_periodo_teste,
      vencimento,
      proxima_cobranca,
      cancelada_em,
      status
    ) VALUES (
      v_empresa_id,
      v_plano_id,
      v_valor_mensal,
      CURRENT_DATE,
      CURRENT_DATE + COALESCE(v_dias_teste, 14),
      NULL,
      NULL,
      NULL,
      'trial'
    )
    ON CONFLICT (empresa_id) DO NOTHING;
  END IF;
END $$;
