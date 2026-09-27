-- ==============================================================================
-- Migration: 20260927200000_modulos_cestas_e_montagem.sql
-- Descrição: Rodada Andrade 1 — Módulos por Empresa + Cestas, Composição e Ordens de Montagem
-- ==============================================================================

-- 1. MÓDULOS NA TABELA EMPRESAS
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS modulos jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Função auxiliar STABLE SECURITY DEFINER para verificar se empresa ativa possui módulo
CREATE OR REPLACE FUNCTION public.empresa_tem_modulo(p_modulo text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_tem boolean;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE((modulos->>p_modulo)::boolean, false)
  INTO v_tem
  FROM public.empresas
  WHERE id = v_empresa_id;

  RETURN COALESCE(v_tem, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_tem_modulo(text) TO authenticated, service_role;

-- 2. TIPO DE ITEM EM PRODUTOS
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tipo_item text NOT NULL DEFAULT 'padrao';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_produtos_tipo_item'
  ) THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT chk_produtos_tipo_item
      CHECK (tipo_item IN ('padrao', 'cesta', 'componente'));
  END IF;
END $$;

-- 3. RESERVA EM ESTOQUES (PREPARAR ESTOQUE)
ALTER TABLE public.estoques
  ADD COLUMN IF NOT EXISTS quantidade_reservada numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_estoques_quantidade_reservada'
  ) THEN
    ALTER TABLE public.estoques
      ADD CONSTRAINT chk_estoques_quantidade_reservada
      CHECK (quantidade_reservada >= 0);
  END IF;
END $$;

-- Ajustar check da tabela movimentacoes_estoque para suportar os novos tipos de montagem
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
    'entrada_montagem'::text
  ]));

-- 4. TABELAS DE COMPOSIÇÃO DE CESTA (HISTÓRICO E VERSIONAMENTO)
CREATE TABLE IF NOT EXISTS public.cesta_composicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cesta_produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  ativa boolean NOT NULL DEFAULT true,
  custo_adicional numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cesta_composicoes_versao UNIQUE (empresa_id, cesta_produto_id, versao),
  CONSTRAINT chk_cesta_custo_adicional CHECK (custo_adicional >= 0)
);

CREATE TABLE IF NOT EXISTS public.cesta_composicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  composicao_id uuid NOT NULL REFERENCES public.cesta_composicoes(id) ON DELETE CASCADE,
  componente_produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade numeric(14,3) NOT NULL,
  unidade text NOT NULL DEFAULT 'UN',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cesta_comp_quantidade CHECK (quantidade > 0),
  CONSTRAINT uq_cesta_composicao_item UNIQUE (composicao_id, componente_produto_id)
);

CREATE INDEX IF NOT EXISTS idx_cesta_comp_empresa ON public.cesta_composicoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cesta_comp_cesta ON public.cesta_composicoes(empresa_id, cesta_produto_id);
CREATE INDEX IF NOT EXISTS idx_cesta_comp_itens_comp ON public.cesta_composicao_itens(composicao_id);
CREATE INDEX IF NOT EXISTS idx_cesta_comp_itens_emp ON public.cesta_composicao_itens(empresa_id);

-- RLS para cesta_composicoes e itens
ALTER TABLE public.cesta_composicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cesta_composicao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cesta_composicoes_select_empresa" ON public.cesta_composicoes;
CREATE POLICY "cesta_composicoes_select_empresa" ON public.cesta_composicoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "cesta_composicao_itens_select_empresa" ON public.cesta_composicao_itens;
CREATE POLICY "cesta_composicao_itens_select_empresa" ON public.cesta_composicao_itens
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 5. TABELA DE ORDENS DE MONTAGEM
CREATE TABLE IF NOT EXISTS public.ordens_montagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero bigint NOT NULL,
  cesta_produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  composicao_versao_id uuid NOT NULL REFERENCES public.cesta_composicoes(id) ON DELETE RESTRICT,
  quantidade_planejada numeric(14,3) NOT NULL,
  quantidade_produzida numeric(14,3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planejada',
  responsavel_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  data_montagem date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  custo_unitario_efetivo numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ordens_montagem_numero UNIQUE (empresa_id, numero),
  CONSTRAINT chk_ordem_montagem_status CHECK (status IN ('planejada', 'concluida', 'cancelada')),
  CONSTRAINT chk_ordem_montagem_qtd_plan CHECK (quantidade_planejada > 0),
  CONSTRAINT chk_ordem_montagem_qtd_prod CHECK (quantidade_produzida >= 0),
  CONSTRAINT chk_ordem_montagem_custo CHECK (custo_unitario_efetivo >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ordens_montagem_empresa ON public.ordens_montagem(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordens_montagem_cesta ON public.ordens_montagem(empresa_id, cesta_produto_id);
CREATE INDEX IF NOT EXISTS idx_ordens_montagem_status ON public.ordens_montagem(empresa_id, status);

ALTER TABLE public.ordens_montagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordens_montagem_select_empresa" ON public.ordens_montagem;
CREATE POLICY "ordens_montagem_select_empresa" ON public.ordens_montagem
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- 6. RPC: salvar_composicao_cesta (cria nova versão, inativa anterior)
CREATE OR REPLACE FUNCTION public.salvar_composicao_cesta(
  p_cesta_produto_id uuid,
  p_custo_adicional numeric,
  p_itens jsonb,
  p_observacoes text DEFAULT NULL
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
  v_produto record;
  v_nova_versao integer := 1;
  v_nova_composicao_id uuid;
  v_item jsonb;
  v_comp_id uuid;
  v_comp_qtd numeric;
  v_comp_rec record;
  v_custo_total numeric := 0;
  v_item_count integer := 0;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui uma empresa válida.';
  END IF;

  SELECT u.id, u.perfil INTO v_usuario_id, v_perfil
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true
  LIMIT 1;

  IF NOT (public.is_manager_or_above()) THEN
    RAISE EXCEPTION 'Usuário não possui permissão para gerenciar composições de cesta.';
  END IF;

  -- Validar módulo de cestas
  IF NOT public.empresa_tem_modulo('modulo_cestas') THEN
    RAISE EXCEPTION 'O módulo de Cestas e Montagem não está habilitado para esta empresa.';
  END IF;

  -- Validar produto cesta
  SELECT id, nome, tipo_item, preco_venda
  INTO v_produto
  FROM public.produtos
  WHERE id = p_cesta_produto_id AND empresa_id = v_empresa_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto da cesta não encontrado ou inativo.';
  END IF;

  IF v_produto.tipo_item <> 'cesta' THEN
    RAISE EXCEPTION 'O produto selecionado não é do tipo cesta.';
  END IF;

  IF p_custo_adicional IS NULL OR p_custo_adicional < 0 THEN
    RAISE EXCEPTION 'Custo adicional inválido.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A composição precisa ter pelo menos um componente.';
  END IF;

  -- Trava por empresa para geração de versão
  PERFORM pg_advisory_xact_lock(hashtext('cesta_comp_' || v_empresa_id::text || '_' || p_cesta_produto_id::text));

  SELECT COALESCE(MAX(versao), 0) + 1
  INTO v_nova_versao
  FROM public.cesta_composicoes
  WHERE empresa_id = v_empresa_id AND cesta_produto_id = p_cesta_produto_id;

  -- Desativar versões anteriores
  UPDATE public.cesta_composicoes
  SET ativa = false, updated_at = now()
  WHERE empresa_id = v_empresa_id AND cesta_produto_id = p_cesta_produto_id;

  -- Inserir nova versão
  INSERT INTO public.cesta_composicoes (
    empresa_id,
    cesta_produto_id,
    versao,
    ativa,
    custo_adicional,
    observacoes,
    created_by
  ) VALUES (
    v_empresa_id,
    p_cesta_produto_id,
    v_nova_versao,
    true,
    p_custo_adicional,
    p_observacoes,
    v_usuario_id
  )
  RETURNING id INTO v_nova_composicao_id;

  -- Processar itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_comp_id := (v_item->>'componente_produto_id')::uuid;
    v_comp_qtd := (v_item->>'quantidade')::numeric;

    IF v_comp_qtd IS NULL OR v_comp_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade de componente inválida na composição.';
    END IF;

    SELECT id, nome, unidade, preco_custo, tipo_item
    INTO v_comp_rec
    FROM public.produtos
    WHERE id = v_comp_id AND empresa_id = v_empresa_id AND ativo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Componente % não encontrado ou inativo.', v_comp_id;
    END IF;

    IF v_comp_rec.tipo_item <> 'componente' AND v_comp_rec.tipo_item <> 'padrao' THEN
      RAISE EXCEPTION 'O item "%" não pode ser usado como componente.', v_comp_rec.nome;
    END IF;

    INSERT INTO public.cesta_composicao_itens (
      empresa_id,
      composicao_id,
      componente_produto_id,
      quantidade,
      unidade
    ) VALUES (
      v_empresa_id,
      v_nova_composicao_id,
      v_comp_id,
      v_comp_qtd,
      COALESCE(v_item->>'unidade', v_comp_rec.unidade, 'UN')
    );

    v_custo_total := v_custo_total + (v_comp_qtd * COALESCE(v_comp_rec.preco_custo, 0));
    v_item_count := v_item_count + 1;
  END LOOP;

  v_custo_total := round(v_custo_total + p_custo_adicional, 2);

  -- Atualizar preco_custo teórico no cadastro do produto cesta
  UPDATE public.produtos
  SET preco_custo = v_custo_total, updated_at = now()
  WHERE id = p_cesta_produto_id AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'composicao_id', v_nova_composicao_id,
    'versao', v_nova_versao,
    'custo_total', v_custo_total,
    'total_itens', v_item_count,
    'preco_venda', v_produto.preco_venda,
    'margem', round(v_produto.preco_venda - v_custo_total, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_composicao_cesta(uuid, numeric, jsonb, text) TO authenticated, service_role;

-- 7. RPC: criar_ordem_montagem
CREATE OR REPLACE FUNCTION public.criar_ordem_montagem(
  p_cesta_produto_id uuid,
  p_quantidade_planejada numeric,
  p_data_montagem date DEFAULT CURRENT_DATE,
  p_observacoes text DEFAULT NULL
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
  v_composicao record;
  v_numero bigint;
  v_ordem_id uuid;
  v_produto_cesta record;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui uma empresa válida.';
  END IF;

  SELECT u.id, u.perfil INTO v_usuario_id, v_perfil
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true
  LIMIT 1;

  -- Quem pode montar: master, admin, gerente, operador
  IF NOT public.is_empresa_operador_or_above() THEN
    RAISE EXCEPTION 'Usuário não possui permissão para criar ordens de montagem.';
  END IF;

  IF NOT public.empresa_tem_modulo('modulo_cestas') THEN
    RAISE EXCEPTION 'O módulo de Cestas e Montagem não está habilitado para esta empresa.';
  END IF;

  IF p_quantidade_planejada IS NULL OR p_quantidade_planejada <= 0 THEN
    RAISE EXCEPTION 'A quantidade planejada deve ser maior que zero.';
  END IF;

  SELECT id, nome, tipo_item INTO v_produto_cesta
  FROM public.produtos
  WHERE id = p_cesta_produto_id AND empresa_id = v_empresa_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cesta não encontrada ou inativa.';
  END IF;

  IF v_produto_cesta.tipo_item <> 'cesta' THEN
    RAISE EXCEPTION 'O produto selecionado não é do tipo cesta.';
  END IF;

  -- Buscar composição ativa congelada
  SELECT id, versao
  INTO v_composicao
  FROM public.cesta_composicoes
  WHERE empresa_id = v_empresa_id
    AND cesta_produto_id = p_cesta_produto_id
    AND ativa = true
  LIMIT 1;

  IF v_composicao.id IS NULL THEN
    RAISE EXCEPTION 'Esta cesta não possui uma composição ativa cadastrada. Cadastre a composição antes de abrir uma ordem.';
  END IF;

  -- Numeração sequencial por empresa com advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('ordem_montagem_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.ordens_montagem
  WHERE empresa_id = v_empresa_id;

  INSERT INTO public.ordens_montagem (
    empresa_id,
    numero,
    cesta_produto_id,
    composicao_versao_id,
    quantidade_planejada,
    quantidade_produzida,
    status,
    responsavel_usuario_id,
    data_montagem,
    observacoes,
    created_by
  ) VALUES (
    v_empresa_id,
    v_numero,
    p_cesta_produto_id,
    v_composicao.id,
    p_quantidade_planejada,
    0,
    'planejada',
    v_usuario_id,
    COALESCE(p_data_montagem, CURRENT_DATE),
    p_observacoes,
    v_usuario_id
  )
  RETURNING id INTO v_ordem_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'ordem_id', v_ordem_id,
    'numero', v_numero,
    'cesta_nome', v_produto_cesta.nome,
    'composicao_versao', v_composicao.versao,
    'quantidade_planejada', p_quantidade_planejada,
    'status', 'planejada'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_ordem_montagem(uuid, numeric, date, text) TO authenticated, service_role;

-- 8. RPC: cancelar_ordem_montagem
CREATE OR REPLACE FUNCTION public.cancelar_ordem_montagem(p_ordem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_ordem record;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado em uma empresa válida.';
  END IF;

  IF NOT public.is_empresa_operador_or_above() THEN
    RAISE EXCEPTION 'Usuário não possui permissão para cancelar ordens de montagem.';
  END IF;

  SELECT id, status, numero INTO v_ordem
  FROM public.ordens_montagem
  WHERE id = p_ordem_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de montagem não encontrada.';
  END IF;

  IF v_ordem.status = 'concluida' THEN
    RAISE EXCEPTION 'Não é possível cancelar uma ordem de montagem já concluída.';
  END IF;

  IF v_ordem.status = 'cancelada' THEN
    RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Ordem já estava cancelada.');
  END IF;

  UPDATE public.ordens_montagem
  SET status = 'cancelada', updated_at = now()
  WHERE id = p_ordem_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'ordem_id', p_ordem_id,
    'numero', v_ordem.numero,
    'status', 'cancelada'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_ordem_montagem(uuid) TO authenticated, service_role;

-- 9. RPC: finalizar_montagem_cestas (atômica, trava FOR UPDATE, validação de falta, baixa/entrada e custo médio)
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

  -- 4. Travar estoques de todos os componentes da composição e verificar saldos
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
  END LOOP;

  -- Se faltar qualquer componente, abortar transação com mensagem clara
  IF v_falta_msg <> '' THEN
    RAISE EXCEPTION 'Estoque insuficiente para montagem da ordem #%:%', v_ordem.numero, v_falta_msg;
  END IF;

  -- 5. Baixar componentes e gravar movimentações de consumo_montagem
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

    UPDATE public.estoques
    SET quantidade = quantidade - v_necessario,
        updated_at = now()
    WHERE produto_id = v_comp_item.componente_produto_id
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
      v_comp_item.componente_produto_id,
      'consumo_montagem',
      v_necessario,
      format('Consumo na Montagem #%s (%s cestas)', v_ordem.numero, v_qtd_final),
      v_ordem.id,
      v_usuario_id
    );
  END LOOP;

  -- Custo efetivo unitário da cesta nesta montagem
  v_custo_total_ordem := v_custo_total_componentes + (v_qtd_final * v_custo_adicional);
  v_custo_unitario_efetivo := round(v_custo_total_ordem / v_qtd_final, 2);

  -- 6. Dar entrada nas cestas prontas e calcular média ponderada de custo
  -- Travar estoque da cesta
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

  -- Média ponderada de custo: (estoque_anterior * custo_anterior + qtd_montada * custo_efetivo) / novo_estoque
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

  -- Gravar movimentação de entrada_montagem para a cesta
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

GRANT EXECUTE ON FUNCTION public.finalizar_montagem_cestas(uuid, numeric) TO authenticated, service_role;

-- 10. ATUALIZAR RPC criar_produto PARA SUPORTAR TIPO_ITEM
CREATE OR REPLACE FUNCTION public.criar_produto(
    p_nome text,
    p_codigo text DEFAULT NULL::text,
    p_categoria_id uuid DEFAULT NULL::uuid,
    p_fornecedor_id uuid DEFAULT NULL::uuid,
    p_unidade text DEFAULT 'UN'::text,
    p_preco_custo numeric DEFAULT 0,
    p_preco_venda numeric DEFAULT 0,
    p_estoque_minimo numeric DEFAULT 0,
    p_estoque_inicial numeric DEFAULT 0,
    p_descricao text DEFAULT NULL::text,
    p_tipo_item text DEFAULT 'padrao'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_produto_id uuid;
    v_limite_produtos integer;
    v_produtos_ativos_count integer;
    v_assinatura_id uuid;
    v_status_ass jsonb;
    v_tipo_final text;
begin
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

    select
        id,
        empresa_id
    into
        v_usuario_id,
        v_empresa_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_empresa_id is null then
        raise exception 'Usuário não possui uma empresa válida.';
    end if;

    -- Travar linha da assinatura para serializar operações e obter limite
    select a.id, p.limite_produtos
    into v_assinatura_id, v_limite_produtos
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    for update;

    if not (
        public.is_admin()
        or public.is_manager_or_above()
    ) then
        raise exception 'Usuário não possui permissão para cadastrar produtos.';
    end if;

    if p_nome is null or trim(p_nome) = '' then
        raise exception 'O nome do produto é obrigatório.';
    end if;

    if p_preco_custo < 0
       or p_preco_venda < 0
       or p_estoque_minimo < 0
       or p_estoque_inicial < 0 then
        raise exception 'Valores numéricos inválidos.';
    end if;

    -- Validar tipo_item
    v_tipo_final := COALESCE(p_tipo_item, 'padrao');
    IF v_tipo_final NOT IN ('padrao', 'cesta', 'componente') THEN
        v_tipo_final := 'padrao';
    END IF;

    -- Se empresa não tem módulo de cestas, força 'padrao'
    IF NOT public.empresa_tem_modulo('modulo_cestas') THEN
        v_tipo_final := 'padrao';
    END IF;

    -- VALIDAR LIMITE DE PRODUTOS DO PLANO
    if v_limite_produtos is not null then
        select count(*)
        into v_produtos_ativos_count
        from public.produtos
        where empresa_id = v_empresa_id
          and ativo = true;

        if v_produtos_ativos_count >= v_limite_produtos then
            raise exception 'Limite de produtos do plano atingido. Faça upgrade do seu plano para adicionar novos produtos.';
        end if;
    end if;

    if p_categoria_id is not null then
        if not exists (
            select 1
            from public.categorias
            where id = p_categoria_id
              and empresa_id = v_empresa_id
              and ativo = true
        ) then
            raise exception 'Categoria inválida.';
        end if;
    end if;

    if p_fornecedor_id is not null then
        if not exists (
            select 1
            from public.fornecedores
            where id = p_fornecedor_id
              and empresa_id = v_empresa_id
              and ativo = true
        ) then
            raise exception 'Fornecedor inválido.';
        end if;
    end if;

    insert into public.produtos (
        empresa_id,
        categoria_id,
        fornecedor_id,
        codigo,
        nome,
        descricao,
        unidade,
        preco_custo,
        preco_venda,
        estoque_minimo,
        tipo_item
    )
    values (
        v_empresa_id,
        p_categoria_id,
        p_fornecedor_id,
        p_codigo,
        p_nome,
        p_descricao,
        p_unidade,
        p_preco_custo,
        p_preco_venda,
        p_estoque_minimo,
        v_tipo_final
    )
    returning id
    into v_produto_id;

    insert into public.estoques (
        empresa_id,
        produto_id,
        quantidade
    )
    values (
        v_empresa_id,
        v_produto_id,
        p_estoque_inicial
    );

    if p_estoque_inicial > 0 then
        insert into public.movimentacoes_estoque (
            empresa_id,
            produto_id,
            tipo,
            quantidade,
            motivo,
            usuario_id
        )
        values (
            v_empresa_id,
            v_produto_id,
            'entrada',
            p_estoque_inicial,
            'Estoque inicial',
            v_usuario_id
        );
    end if;

    return jsonb_build_object(
        'sucesso', true,
        'produto_id', v_produto_id,
        'estoque_inicial', p_estoque_inicial,
        'tipo_item', v_tipo_final
    );
end;
$$;

GRANT EXECUTE ON FUNCTION public.criar_produto(text, text, uuid, uuid, text, numeric, numeric, numeric, numeric, text, text) TO authenticated, service_role;

-- 11. ATUALIZAR finalizar_venda COM VALIDAÇÃO DE CESTA PARA EMPRESAS COM O MÓDULO
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
  v_tipo_item text;

  v_modulo_cestas boolean;
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

  -- Módulo de cestas ligado?
  v_modulo_cestas := public.empresa_tem_modulo('modulo_cestas');

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
    SELECT p.nome, p.preco_venda, p.tipo_item
    INTO v_produto_nome, v_preco, v_tipo_item
    FROM public.produtos p
    WHERE p.id = v_produto_id
      AND p.empresa_id = v_empresa_id
      AND p.ativo = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não existe ou pertence a outra empresa.';
    END IF;

    -- Regra Andrade: Distribui SOMENTE cestas. Componente NÃO pode ser vendido diretamente
    IF v_modulo_cestas AND v_tipo_item = 'componente' THEN
      RAISE EXCEPTION 'O item "%" é um componente e não pode ser vendido diretamente. Venda somente cestas prontas.', v_produto_nome;
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

  -- 12. INSERIR ITENS + BAIXAR ESTOQUE (baixa SOMENTE o produto vendido / cesta, nunca componentes)
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

GRANT EXECUTE ON FUNCTION public.finalizar_venda(uuid, uuid, jsonb, numeric, text, date, text) TO authenticated, service_role;

-- 12. ATUALIZAR criar_pedido COM VALIDAÇÃO DE CESTA PARA EMPRESAS COM O MÓDULO
CREATE OR REPLACE FUNCTION public.criar_pedido(
  p_cliente_id uuid DEFAULT NULL::uuid,
  p_vendedor_id uuid DEFAULT NULL::uuid,
  p_itens jsonb DEFAULT NULL::jsonb,
  p_observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_perfil text;
  v_pedido_id uuid;
  v_numero bigint;
  v_total numeric(14,2) := 0;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric(14,3);
  v_preco_unitario numeric(14,2);
  v_desconto numeric(14,2);
  v_subtotal numeric(14,2);
  v_qtd_itens integer := 0;
  v_status_ass jsonb;
  v_modulo_cestas boolean;
  v_produto_nome text;
  v_tipo_item text;
BEGIN
  -- 0. Validar status da assinatura
  v_status_ass := public.get_status_assinatura();
  IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
  END IF;

  -- 1. Identificar usuário e empresa
  SELECT id, empresa_id, perfil
  INTO v_usuario_id, v_empresa_id, v_perfil
  FROM public.usuarios
  WHERE auth_user_id = auth.uid()
    AND ativo = true
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não está vinculado a uma empresa.';
  END IF;

  -- 2. Validar permissão
  IF NOT public.is_vendedor_or_above() THEN
    RAISE EXCEPTION 'Usuário não possui permissão para criar pedidos.';
  END IF;

  -- 3. Validar cliente
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = p_cliente_id
        AND empresa_id = v_empresa_id
        AND ativo = true
    ) THEN
      RAISE EXCEPTION 'Cliente inválido ou pertence a outra empresa.';
    END IF;
  END IF;

  -- 4. Validar vendedor
  IF p_vendedor_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendedores
      WHERE id = p_vendedor_id
        AND empresa_id = v_empresa_id
        AND ativo = true
    ) THEN
      RAISE EXCEPTION 'Vendedor inválido ou pertence a outra empresa.';
    END IF;
  END IF;

  -- 5. Validar itens
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item.';
  END IF;

  v_modulo_cestas := public.empresa_tem_modulo('modulo_cestas');

  -- 6. Gerar número do pedido (com lock para evitar duplicidade)
  PERFORM pg_advisory_xact_lock(hashtext('empresa_pedido_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.pedidos
  WHERE empresa_id = v_empresa_id;

  -- 7. Inserir pedido com OVERRIDING SYSTEM VALUE
  INSERT INTO public.pedidos (
    empresa_id,
    cliente_id,
    vendedor_id,
    numero,
    total,
    status,
    observacoes
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id,
    p_cliente_id,
    p_vendedor_id,
    v_numero,
    0,
    'pendente',
    p_observacoes
  )
  RETURNING id INTO v_pedido_id;

  -- 8. Processar itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::numeric;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para um dos produtos.';
    END IF;

    SELECT nome, preco_venda, tipo_item
    INTO v_produto_nome, v_preco_unitario, v_tipo_item
    FROM public.produtos
    WHERE id = v_produto_id
      AND empresa_id = v_empresa_id
      AND ativo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % não existe ou pertence a outra empresa.', v_produto_id;
    END IF;

    IF v_modulo_cestas AND v_tipo_item = 'componente' THEN
      RAISE EXCEPTION 'O item "%" é um componente e não pode constar em pedidos. Distribua somente cestas prontas.', v_produto_nome;
    END IF;

    v_desconto := COALESCE((v_item ->> 'desconto')::numeric, 0);
    IF v_desconto < 0 THEN
      RAISE EXCEPTION 'Desconto não pode ser negativo para o produto %.', v_produto_id;
    END IF;

    v_subtotal := ROUND((v_quantidade * v_preco_unitario) - v_desconto, 2);
    IF v_subtotal < 0 THEN
      RAISE EXCEPTION 'Desconto não pode ser maior que o valor do item para o produto %.', v_produto_id;
    END IF;

    INSERT INTO public.itens_pedido (
      empresa_id,
      pedido_id,
      produto_id,
      quantidade,
      preco_unitario,
      desconto,
      subtotal
    )
    VALUES (
      v_empresa_id,
      v_pedido_id,
      v_produto_id,
      v_quantidade,
      v_preco_unitario,
      v_desconto,
      v_subtotal
    );

    v_total := v_total + v_subtotal;
    v_qtd_itens := v_qtd_itens + 1;
  END LOOP;

  -- 9. Atualizar total do pedido
  UPDATE public.pedidos
  SET total = v_total, updated_at = now()
  WHERE id = v_pedido_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'pedido_id', v_pedido_id,
    'numero', v_numero,
    'total', v_total,
    'quantidade_itens', v_qtd_itens,
    'status', 'pendente'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.criar_pedido(uuid, uuid, jsonb, text) TO authenticated, service_role;

-- 13. ATUALIZAR converter_pedido_em_venda COM VALIDAÇÃO DE CESTA
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
  v_numero_venda bigint;

  v_comissao_percentual numeric(5,2) := 0;
  v_valor_comissao numeric(14,2) := 0;

  v_estoque_atual numeric(14,3);
  v_modulo_cestas boolean;
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

  -- 2. VALIDAR PERMISSÃO
  IF v_perfil NOT IN ('master', 'admin', 'gerente', 'vendedor') THEN
    RAISE EXCEPTION 'Usuário não possui permissão para converter pedidos em venda.';
  END IF;

  -- 3. VALIDAR FORMA DE PAGAMENTO
  IF lower(p_forma_pagamento) NOT IN ('dinheiro', 'pix', 'cartao', 'fiado') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  -- SERIALIZAR OPERAÇÃO DE LIMITE (FOR UPDATE)
  SELECT a.id, p.limite_vendas_mes
  INTO v_assinatura_id, v_limite_vendas_mes
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = v_empresa_id
    AND a.status IN ('trial', 'ativa')
  FOR UPDATE;

  -- 4. VALIDAR LIMITE DE VENDAS DO PLANO NO MÊS (SP timezone)
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

  -- 5. TRAVAR PEDIDO E VALIDAR
  SELECT *
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou pertence a outra empresa.';
  END IF;

  IF v_pedido.status <> 'pendente' THEN
    RAISE EXCEPTION 'Somente pedidos com status pendente podem ser convertidos em venda. Status atual: %.', v_pedido.status;
  END IF;

  v_modulo_cestas := public.empresa_tem_modulo('modulo_cestas');

  -- 6. VALIDAR ESTOQUES E TIPOS DE ITEM DE TODOS OS ITENS COM SELECT ... FOR UPDATE
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

    SELECT quantidade
    INTO v_estoque_atual
    FROM public.estoques
    WHERE produto_id = v_item.produto_id
      AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_estoque_atual IS NULL THEN
      RAISE EXCEPTION 'Produto "%" não possui estoque registrado na empresa.', v_item.produto_nome;
    END IF;

    IF v_estoque_atual < v_item.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%": disponível %, solicitado %.',
        v_item.produto_nome,
        v_estoque_atual,
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

  -- 9. TRANSFERIR ITENS E BAIXAR ESTOQUE
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
      'Venda #' || v_numero_venda || ' (Convertida do Pedido #' || v_pedido.numero || ')',
      v_venda_id,
      v_usuario_id
    );
  END LOOP;

  -- 10. ATUALIZAR STATUS DO PEDIDO PARA FATURADO
  UPDATE public.pedidos
  SET status = 'faturado', updated_at = now()
  WHERE id = p_pedido_id;

  -- 11. FINANCEIRO (SE FIADO)
  IF lower(p_forma_pagamento) = 'fiado' THEN
    IF v_pedido.cliente_id IS NULL THEN
      RAISE EXCEPTION 'Venda fiada precisa possuir um cliente associado ao pedido.';
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
      'Venda #' || v_numero_venda || ' (Pedido #' || v_pedido.numero || ')',
      v_pedido.total,
      COALESCE(p_vencimento, public.sp_date(now())),
      'pendente'
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

GRANT EXECUTE ON FUNCTION public.converter_pedido_em_venda(uuid, text, date) TO authenticated, service_role;

-- 14. ATUALIZAR editar_empresa_cadastral_admin e listar_empresas_admin PARA SUPORTAR MODULOS
CREATE OR REPLACE FUNCTION public.editar_empresa_cadastral_admin(p_empresa_id uuid, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_admin_id uuid;
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    select id into v_admin_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and perfil = 'platform_admin'
      and ativo = true
    limit 1;

    update public.empresas
    set 
        nome = coalesce(trim(p_dados->>'nome'), nome),
        nome_fantasia = p_dados->>'nome_fantasia',
        cnpj = coalesce(p_dados->>'cnpj', cnpj),
        inscricao_estadual = p_dados->>'inscricao_estadual',
        inscricao_municipal = p_dados->>'inscricao_municipal',
        email = p_dados->>'email',
        telefone = p_dados->>'telefone',
        whatsapp = p_dados->>'whatsapp',
        cep = p_dados->>'cep',
        estado = p_dados->>'estado',
        cidade = p_dados->>'cidade',
        bairro = p_dados->>'bairro',
        endereco = p_dados->>'endereco',
        numero = p_dados->>'numero',
        complemento = p_dados->>'complemento',
        observacoes = p_dados->>'observacoes',
        responsavel_nome = p_dados->>'responsavel_nome',
        responsavel_cpf = p_dados->>'responsavel_cpf',
        responsavel_email = p_dados->>'responsavel_email',
        responsavel_telefone = p_dados->>'responsavel_telefone',
        responsavel_whatsapp = p_dados->>'responsavel_whatsapp',
        responsavel_cargo = p_dados->>'responsavel_cargo',
        status = coalesce(p_dados->>'status', status),
        modulos = case when p_dados ? 'modulos' then (p_dados->'modulos') else modulos end,
        updated_at = now()
    where id = p_empresa_id;

    -- Log
    insert into public.log_assinaturas (
        empresa_id,
        tipo,
        descricao,
        usuario_responsavel_id,
        metadata
    ) values (
        p_empresa_id,
        'edicao_cadastral',
        'Dados cadastrais e módulos da empresa atualizados pelo Platform Admin.',
        v_admin_id,
        p_dados
    );

    return jsonb_build_object('success', true, 'message', 'Dados cadastrais atualizados com sucesso.');
end;
$function$;

GRANT EXECUTE ON FUNCTION public.editar_empresa_cadastral_admin(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_empresas_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_empresas jsonb;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado: apenas administradores da plataforma podem listar empresas.';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', e.id,
                'nome', e.nome,
                'nome_fantasia', e.nome_fantasia,
                'cnpj', e.cnpj,
                'email', e.email,
                'telefone', e.telefone,
                'status', e.status,
                'modulos', COALESCE(e.modulos, '{}'::jsonb),
                'created_at', e.created_at,
                'plano_id', a.plano_id,
                'plano_nome', p.nome,
                'plano_slug', p.slug,
                'status_assinatura', a.status,
                'valor_assinatura', a.valor,
                'inicio', a.inicio,
                'vencimento', a.vencimento,
                'fim_periodo_teste', a.fim_periodo_teste,
                'total_usuarios', coalesce(u.total_usuarios, 0)
            ) order by e.created_at desc
        ),
        '[]'::jsonb
    ) into v_empresas
    from public.empresas e
    left join public.assinaturas a on a.empresa_id = e.id
    left join public.planos p on p.id = a.plano_id
    left join (
        select empresa_id, count(*) as total_usuarios
        from public.usuarios
        where ativo = true
        group by empresa_id
    ) u on u.empresa_id = e.id;

    return v_empresas;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_empresas_admin() TO authenticated, service_role;
