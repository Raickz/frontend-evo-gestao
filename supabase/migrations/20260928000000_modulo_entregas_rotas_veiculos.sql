-- Migration: 20260928000000_modulo_entregas_rotas_veiculos.sql
-- Rodada Andrade 3: Módulo Entregas, Frota de Veículos, Gestão de Rotas, Venda na Rua, Conclusão de Pedidos e Fechamento com Acerto.

-- ============================================================================
-- 1. CARGO 'entregador' E FUNÇÕES DE CARGO
-- ============================================================================

-- Atualizar CHECK constraint usuarios_perfil_check para incluir 'entregador'
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_check 
  CHECK (perfil = ANY (ARRAY['master'::text, 'admin'::text, 'gerente'::text, 'vendedor'::text, 'operador'::text, 'entregador'::text, 'platform_admin'::text]));

-- Atualizar is_vendedor_or_above() para incluir entregador (para permissões operacionais como leitura de clientes e devedores/recebimento)
CREATE OR REPLACE FUNCTION public.is_vendedor_or_above()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND perfil IN ('master', 'admin', 'gerente', 'vendedor', 'entregador')
      AND ativo = true
  );
$$;

-- Função auxiliar para verificar se é entregador
CREATE OR REPLACE FUNCTION public.is_entregador()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND perfil = 'entregador'
      AND ativo = true
  );
$$;

-- RLS de clientes: certificar permissões para entregador
DROP POLICY IF EXISTS "clientes_select_empresa" ON public.clientes;
CREATE POLICY "clientes_select_empresa" ON public.clientes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "clientes_insert_empresa" ON public.clientes;
CREATE POLICY "clientes_insert_empresa" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND (public.is_admin() OR public.is_manager_or_above() OR public.is_vendedor_or_above())
  );

-- ============================================================================
-- 2. TABELAS DO MÓDULO ENTREGAS
-- ============================================================================

-- 2.1 veiculos
CREATE TABLE IF NOT EXISTS public.veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  identificacao text NOT NULL,
  placa text NOT NULL,
  modelo text,
  capacidade_cestas numeric NOT NULL DEFAULT 0 CHECK (capacidade_cestas >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_empresa ON public.veiculos(empresa_id);

-- 2.2 rotas
CREATE TABLE IF NOT EXISTS public.rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero bigint NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  responsavel_usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'finalizada')),
  horario_saida timestamptz,
  horario_fechamento timestamptz,
  observacoes text,
  divergencia_fechamento jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rotas_empresa_numero UNIQUE (empresa_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_rotas_empresa ON public.rotas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rotas_responsavel ON public.rotas(responsavel_usuario_id);
CREATE INDEX IF NOT EXISTS idx_rotas_data ON public.rotas(empresa_id, data);
CREATE INDEX IF NOT EXISTS idx_rotas_status ON public.rotas(empresa_id, status);

-- 2.3 rota_itens_estoque
CREATE TABLE IF NOT EXISTS public.rota_itens_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade_carregada numeric NOT NULL DEFAULT 0 CHECK (quantidade_carregada >= 0),
  quantidade_vendida numeric NOT NULL DEFAULT 0 CHECK (quantidade_vendida >= 0),
  quantidade_entregue numeric NOT NULL DEFAULT 0 CHECK (quantidade_entregue >= 0),
  quantidade_devolvida numeric NOT NULL DEFAULT 0 CHECK (quantidade_devolvida >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rota_itens_estoque UNIQUE (rota_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_rota_itens_estoque_rota ON public.rota_itens_estoque(rota_id);
CREATE INDEX IF NOT EXISTS idx_rota_itens_estoque_empresa ON public.rota_itens_estoque(empresa_id);

-- 2.4 rota_pedidos
CREATE TABLE IF NOT EXISTS public.rota_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  ordem_entrega integer NOT NULL DEFAULT 1 CHECK (ordem_entrega >= 1),
  status_entrega text NOT NULL DEFAULT 'pendente' CHECK (status_entrega IN ('pendente', 'entregue', 'nao_entregue')),
  motivo_nao_entrega text,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  horario_conclusao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rota_pedidos UNIQUE (rota_id, pedido_id)
);

CREATE INDEX IF NOT EXISTS idx_rota_pedidos_rota ON public.rota_pedidos(rota_id);
CREATE INDEX IF NOT EXISTS idx_rota_pedidos_pedido ON public.rota_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_rota_pedidos_empresa ON public.rota_pedidos(empresa_id);

-- ============================================================================
-- 3. HABILITAR RLS NAS TABELAS NOVAS (PADRÃO B1 MULTITENANT COM EMPRESA_ID)
-- ============================================================================

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_itens_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_pedidos ENABLE ROW LEVEL SECURITY;

-- Policies para veiculos
DROP POLICY IF EXISTS "veiculos_select_empresa" ON public.veiculos;
CREATE POLICY "veiculos_select_empresa" ON public.veiculos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "veiculos_insert_empresa" ON public.veiculos;
CREATE POLICY "veiculos_insert_empresa" ON public.veiculos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND public.is_manager_or_above());

DROP POLICY IF EXISTS "veiculos_update_empresa" ON public.veiculos;
CREATE POLICY "veiculos_update_empresa" ON public.veiculos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND public.is_manager_or_above())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- Policies para rotas
DROP POLICY IF EXISTS "rotas_select_empresa" ON public.rotas;
CREATE POLICY "rotas_select_empresa" ON public.rotas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "rotas_insert_empresa" ON public.rotas;
CREATE POLICY "rotas_insert_empresa" ON public.rotas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND public.is_manager_or_above());

DROP POLICY IF EXISTS "rotas_update_empresa" ON public.rotas;
CREATE POLICY "rotas_update_empresa" ON public.rotas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- Policies para rota_itens_estoque
DROP POLICY IF EXISTS "rota_itens_estoque_select_empresa" ON public.rota_itens_estoque;
CREATE POLICY "rota_itens_estoque_select_empresa" ON public.rota_itens_estoque
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- Policies para rota_pedidos
DROP POLICY IF EXISTS "rota_pedidos_select_empresa" ON public.rota_pedidos;
CREATE POLICY "rota_pedidos_select_empresa" ON public.rota_pedidos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- ============================================================================
-- 4. CORREÇÃO DE SEGURANÇA EM finalizar_venda
-- ============================================================================
-- Regra Andrade: Estouro de limite de crédito só é aceito se QUEM ESTÁ LOGADO
-- (via auth.uid()) for master/admin/gerente; ignorar/recusar p_autorizador_id de terceiros.
-- Se estourar e o usuário logado for vendedor/entregador: "Limite excedido — peça a um gerente para concluir a venda".
-- Registrar em auditoria_operacoes com: tipo_operacao='estouro_limite_credito',
-- tabela_referencia='vendas', referencia_id=venda_id, motivo.

CREATE OR REPLACE FUNCTION public.finalizar_venda(
  p_cliente_id uuid,
  p_vendedor_id uuid,
  p_itens jsonb,
  p_desconto numeric DEFAULT 0,
  p_forma_pagamento text DEFAULT 'pix'::text,
  p_vencimento date DEFAULT NULL::date,
  p_observacoes text DEFAULT NULL::text,
  p_pagamentos jsonb DEFAULT NULL::jsonb,
  p_condicao text DEFAULT 'a_vista'::text,
  p_entrada_valor numeric DEFAULT 0,
  p_entrada_forma text DEFAULT 'pix'::text,
  p_num_parcelas integer DEFAULT 1,
  p_intervalo_dias integer DEFAULT 30,
  p_autorizador_id uuid DEFAULT NULL::uuid
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
  v_estoque record;
  v_disponivel numeric;
  v_produto_nome text;
  v_tipo_item text;

  v_modulo_cestas boolean;
  v_modulo_crediario boolean;
  v_comissao_percentual numeric(5,2) := 0;
  v_valor_comissao numeric(14,2) := 0;

  v_status_ass jsonb;
  v_cliente record;
  v_saldo_devedor_atual numeric(14,2) := 0;
  v_tem_vencida boolean := false;
  v_novo_saldo numeric(14,2) := 0;
  v_houve_estouro boolean := false;

  -- Parcelamento
  v_valor_a_financiar numeric(14,2) := 0;
  v_valor_base_parcela numeric(14,2);
  v_valor_ultima_parcela numeric(14,2);
  v_soma_parcelas_base numeric(14,2);
  v_vencimento_parc date;
  v_idx integer;

  -- Pagamento dividido à vista
  v_pag jsonb;
  v_soma_divida numeric(14,2) := 0;
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
  IF v_perfil NOT IN ('master', 'admin', 'gerente', 'vendedor', 'entregador') THEN
    RAISE EXCEPTION 'Usuário não possui permissão para realizar vendas.';
  END IF;

  -- 3. VALIDAR LIMITE DE VENDAS DO PLANO NO MÊS CORRENTE
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

  v_modulo_cestas := public.empresa_tem_modulo('modulo_cestas');
  v_modulo_crediario := public.empresa_tem_modulo('modulo_crediario');

  -- 4. VALIDAR CLIENTE
  IF p_cliente_id IS NOT NULL THEN
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = p_cliente_id
      AND empresa_id = v_empresa_id
      AND ativo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente inválido ou pertencente a outra empresa.';
    END IF;
  END IF;

  -- 5. VALIDAR VENDEDOR
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

  -- 6. VALIDAR ITENS
  IF p_itens IS NULL
     OR jsonb_typeof(p_itens) <> 'array'
     OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A venda precisa possuir pelo menos um produto.';
  END IF;

  -- 7. CALCULAR VENDA E VALIDAR ESTOQUE DISPONÍVEL (NÃO PODE CONSUMIR RESERVADO!)
  FOR v_item IN
    SELECT *
    FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::numeric;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para um dos produtos.';
    END IF;

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

    IF v_modulo_cestas AND v_tipo_item = 'componente' THEN
      RAISE EXCEPTION 'O item "%" é um componente e não pode ser vendido diretamente. Venda somente cestas prontas.', v_produto_nome;
    END IF;

    -- BLOQUEAR REGISTRO DE ESTOQUE COM SELECT ... FOR UPDATE
    SELECT *
    INTO v_estoque
    FROM public.estoques
    WHERE produto_id = v_produto_id
      AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%": disponível 0, solicitado %.',
        v_produto_nome, v_quantidade;
    END IF;

    -- REGRA CRÍTICA: A venda direta só pode usar o DISPONÍVEL (físico - reservado)
    v_disponivel := COALESCE(v_estoque.quantidade, 0) - COALESCE(v_estoque.quantidade_reservada, 0);

    IF v_disponivel < v_quantidade THEN
      RAISE EXCEPTION 'Estoque disponível insuficiente para o produto "%" (físico: %, reservado: %, disponível para venda direta: %, solicitado: %). Venda direta não pode consumir cestas reservadas.',
        v_produto_nome,
        COALESCE(v_estoque.quantidade, 0),
        COALESCE(v_estoque.quantidade_reservada, 0),
        v_disponivel,
        v_quantidade;
    END IF;

    v_subtotal_item := round(v_quantidade * v_preco, 2);
    v_subtotal := v_subtotal + v_subtotal_item;
  END LOOP;

  -- 8. VALIDAR DESCONTO
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

  -- 9. REGRAS DE CONDIÇÃO DE PAGAMENTO: À VISTA (DIVIDIDO) OU PARCELADO (CREDIÁRIO)
  IF p_condicao = 'parcelado' OR lower(p_forma_pagamento) IN ('crediario', 'fiado') THEN
    IF NOT v_modulo_crediario THEN
      IF lower(p_forma_pagamento) <> 'fiado' THEN
        RAISE EXCEPTION 'O módulo Crediário não está habilitado para esta empresa.';
      END IF;
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

    IF p_entrada_valor < 0 OR p_entrada_valor > v_total THEN
      RAISE EXCEPTION 'Valor de entrada inválido: %.', p_entrada_valor;
    END IF;

    v_valor_a_financiar := round(v_total - p_entrada_valor, 2);

    -- Verificar parcelas vencidas do cliente e saldo devedor atual em aberto
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
    WHERE cr.cliente_id = p_cliente_id
      AND cr.status IN ('pendente', 'atrasado');

    v_novo_saldo := v_saldo_devedor_atual + v_valor_a_financiar;

    -- CORREÇÃO DE SEGURANÇA: Estouro de limite só pode ser aceito se quem está LOGADO for master/admin/gerente
    IF COALESCE(v_cliente.limite_credito, 0) > 0 AND v_novo_saldo > v_cliente.limite_credito THEN
      IF v_perfil NOT IN ('master', 'admin', 'gerente') THEN
        RAISE EXCEPTION 'Limite excedido — peça a um gerente para concluir a venda';
      END IF;
      v_houve_estouro := true;
    END IF;
  END IF;

  -- 10. NUMERAÇÃO DA VENDA POR EMPRESA
  PERFORM pg_advisory_xact_lock(hashtext('empresa_venda_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.vendas
  WHERE empresa_id = v_empresa_id;

  -- 11. INSERIR VENDA
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
    CASE WHEN p_condicao = 'parcelado' THEN 'crediario' ELSE lower(p_forma_pagamento) END,
    'finalizada',
    p_observacoes,
    v_usuario_id
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
      'Autorização de estouro de limite de crédito pelo usuário autenticado (' || v_perfil || ')',
      jsonb_build_object(
        'cliente_id', p_cliente_id,
        'limite_credito', v_cliente.limite_credito,
        'saldo_anterior', v_saldo_devedor_atual,
        'novo_saldo', v_novo_saldo,
        'venda_numero', v_numero
      )
    );
  END IF;

  -- 12. INSERIR ITENS + BAIXAR ESTOQUE FÍSICO
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

  -- 13. FINANCEIRO: À VISTA (DIVIDIDO OU INTEGRAL) OU PARCELADO COM ENTRADA E TÍTULOS
  IF p_condicao = 'parcelado' THEN
    IF p_entrada_valor > 0 THEN
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
        lower(p_entrada_forma),
        p_entrada_valor,
        'recebido',
        CURRENT_DATE,
        'Entrada Venda #' || v_numero
      );
    END IF;

    IF v_valor_a_financiar > 0 THEN
      v_valor_base_parcela := trunc((v_valor_a_financiar / p_num_parcelas)::numeric, 2);
      v_soma_parcelas_base := v_valor_base_parcela * (p_num_parcelas - 1);
      v_valor_ultima_parcela := round(v_valor_a_financiar - v_soma_parcelas_base, 2);

      FOR v_idx IN 1..p_num_parcelas LOOP
        v_vencimento_parc := CURRENT_DATE + ((v_idx * COALESCE(p_intervalo_dias, 30)) || ' days')::interval;

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
          p_cliente_id,
          v_venda_id,
          'Venda #' || v_numero || ' (' || v_idx || '/' || p_num_parcelas || ')',
          CASE WHEN v_idx = p_num_parcelas THEN v_valor_ultima_parcela ELSE v_valor_base_parcela END,
          v_vencimento_parc,
          'pendente',
          v_idx || '/' || p_num_parcelas,
          CASE WHEN v_houve_estouro THEN v_usuario_id ELSE NULL END
        );
      END LOOP;
    END IF;

  ELSIF p_pagamentos IS NOT NULL AND jsonb_typeof(p_pagamentos) = 'array' AND jsonb_array_length(p_pagamentos) > 0 THEN
    FOR v_pag IN SELECT * FROM jsonb_array_elements(p_pagamentos)
    LOOP
      v_soma_divida := v_soma_divida + (v_pag->>'valor')::numeric;

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

    IF round(v_soma_divida, 2) <> round(v_total, 2) THEN
      RAISE EXCEPTION 'A soma dos pagamentos divididos (%) não confere com o total da venda (%).',
        round(v_soma_divida, 2), round(v_total, 2);
    END IF;

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
      v_total,
      'recebido',
      CURRENT_DATE
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
    'forma_pagamento', CASE WHEN p_condicao = 'parcelado' THEN 'crediario' ELSE lower(p_forma_pagamento) END,
    'comissao', v_valor_comissao,
    'parcelado', (p_condicao = 'parcelado'),
    'cliente_tem_vencida', v_tem_vencida,
    'saldo_devedor_novo', v_novo_saldo
  );
END;
$$;

-- ============================================================================
-- 5. RPC 1: carregar_veiculo_rota
-- ============================================================================
-- Assinatura: carregar_veiculo_rota(p_rota_id uuid, p_itens jsonb, p_pedido_ids uuid[])
-- - Transfere cestas do depósito (só do DISPONÍVEL = físico − reservado) para o carro com movimentação de transferência (saída depósito / entrada carro)
-- - Pedidos confirmados escolhidos vão junto com suas cestas RESERVADAS (reserva passa a ficar no carro, ainda vinculada ao pedido)
-- - Respeita capacidade_cestas do veículo
-- - Rota passa a 'em_andamento' com horario_saida
CREATE OR REPLACE FUNCTION public.carregar_veiculo_rota(
  p_rota_id uuid,
  p_itens jsonb DEFAULT '[]'::jsonb,
  p_pedido_ids uuid[] DEFAULT ARRAY[]::uuid[]
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
  v_veiculo record;
  v_item jsonb;
  v_produto_id uuid;
  v_qtd numeric;
  v_estoque record;
  v_disponivel numeric;
  v_total_cestas_carga numeric := 0;
  v_pedido_id uuid;
  v_ped_rec record;
  v_ped_item record;
  v_ped_count integer := 0;
  v_ordem integer := 1;
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

  -- Permissão: master, admin ou gerente pode despachar/carregar rota
  IF v_perfil NOT IN ('master', 'admin', 'gerente') THEN
    RAISE EXCEPTION 'Apenas administradores ou gerentes podem despachar e carregar rotas.';
  END IF;

  -- Travar rota FOR UPDATE
  SELECT * INTO v_rota
  FROM public.rotas
  WHERE id = p_rota_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada.';
  END IF;

  IF v_rota.status <> 'aberta' THEN
    RAISE EXCEPTION 'A rota #% não está aberta para carregamento (status atual: %).', v_rota.numero, v_rota.status;
  END IF;

  -- Buscar veículo
  SELECT * INTO v_veiculo
  FROM public.veiculos
  WHERE id = v_rota.veiculo_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veículo não encontrado.';
  END IF;

  -- 1. Calcular cestas avulsas a carregar
  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_qtd := (v_item->>'quantidade')::numeric;
      IF v_qtd > 0 THEN
        v_total_cestas_carga := v_total_cestas_carga + v_qtd;
      END IF;
    END LOOP;
  END IF;

  -- 2. Calcular cestas dos pedidos a carregar
  IF p_pedido_ids IS NOT NULL AND array_length(p_pedido_ids, 1) > 0 THEN
    FOREACH v_pedido_id IN ARRAY p_pedido_ids
    LOOP
      SELECT * INTO v_ped_rec
      FROM public.pedidos
      WHERE id = v_pedido_id AND empresa_id = v_empresa_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido % não encontrado na empresa.', v_pedido_id;
      END IF;

      IF v_ped_rec.status NOT IN ('pendente', 'confirmado') THEN
        RAISE EXCEPTION 'Pedido #% está com status "%". Apenas pendentes ou confirmados podem ser despachados na rota.',
          v_ped_rec.numero, v_ped_rec.status;
      END IF;

      -- Somar itens do pedido
      FOR v_ped_item IN
        SELECT ip.produto_id, ip.quantidade
        FROM public.itens_pedido ip
        WHERE ip.pedido_id = v_pedido_id AND ip.empresa_id = v_empresa_id
      LOOP
        v_total_cestas_carga := v_total_cestas_carga + v_ped_item.quantidade;
      END LOOP;
    END LOOP;
  END IF;

  -- 3. Validar capacidade do veículo
  IF v_veiculo.capacidade_cestas > 0 AND v_total_cestas_carga > v_veiculo.capacidade_cestas THEN
    RAISE EXCEPTION 'Carga de % cestas excede a capacidade do veículo % (capacidade máxima: % cestas).',
      v_total_cestas_carga, v_veiculo.identificacao, v_veiculo.capacidade_cestas;
  END IF;

  -- 4. Processar itens avulsos do depósito para o carro
  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_produto_id := (v_item->>'produto_id')::uuid;
      v_qtd := (v_item->>'quantidade')::numeric;

      IF v_qtd > 0 THEN
        -- Bloquear estoque com FOR UPDATE
        SELECT * INTO v_estoque
        FROM public.estoques
        WHERE produto_id = v_produto_id AND empresa_id = v_empresa_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Produto sem estoque registrado.';
        END IF;

        -- Só pode transferir do DISPONÍVEL (físico - reservado)
        v_disponivel := COALESCE(v_estoque.quantidade, 0) - COALESCE(v_estoque.quantidade_reservada, 0);
        IF v_disponivel < v_qtd THEN
          RAISE EXCEPTION 'Estoque disponível insuficiente para o produto (disponível: %, solicitado carregar: %).',
            v_disponivel, v_qtd;
        END IF;

        -- Baixa do estoque físico do depósito
        UPDATE public.estoques
        SET quantidade = quantidade - v_qtd,
            updated_at = now()
        WHERE id = v_estoque.id;

        -- Movimentação de transferência
        INSERT INTO public.movimentacoes_estoque (
          empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id
        ) VALUES (
          v_empresa_id, v_produto_id, 'transferencia_saida', v_qtd,
          'Carregamento Rota #' || v_rota.numero || ' - Veículo ' || v_veiculo.identificacao,
          v_rota.id, v_usuario_id
        );

        -- Upsert em rota_itens_estoque
        INSERT INTO public.rota_itens_estoque (
          empresa_id, rota_id, produto_id, quantidade_carregada
        ) VALUES (
          v_empresa_id, v_rota.id, v_produto_id, v_qtd
        )
        ON CONFLICT (rota_id, produto_id) DO UPDATE
        SET quantidade_carregada = rota_itens_estoque.quantidade_carregada + EXCLUDED.quantidade_carregada,
            updated_at = now();
      END IF;
    END LOOP;
  END IF;

  -- 5. Processar pedidos despachados na rota
  IF p_pedido_ids IS NOT NULL AND array_length(p_pedido_ids, 1) > 0 THEN
    FOREACH v_pedido_id IN ARRAY p_pedido_ids
    LOOP
      -- Para cada item do pedido, transfere físico do depósito para o carro
      -- Se o pedido já estava confirmado (reserva existia), a reserva é abatida do depósito pois agora está no carro
      -- Se estava pendente, apenas transfere físico
      FOR v_ped_item IN
        SELECT ip.produto_id, ip.quantidade
        FROM public.itens_pedido ip
        WHERE ip.pedido_id = v_pedido_id AND ip.empresa_id = v_empresa_id
      LOOP
        SELECT * INTO v_estoque
        FROM public.estoques
        WHERE produto_id = v_ped_item.produto_id AND empresa_id = v_empresa_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Produto do pedido sem estoque no depósito.';
        END IF;

        IF v_estoque.quantidade < v_ped_item.quantidade THEN
          RAISE EXCEPTION 'Estoque insuficiente no depósito para atender o pedido despachado.';
        END IF;

        -- Obter status atual do pedido
        SELECT status INTO v_ped_rec FROM public.pedidos WHERE id = v_pedido_id;

        IF v_ped_rec.status = 'confirmado' THEN
          -- Diminui físico E reserva do depósito (passam a estar a bordo do carro)
          UPDATE public.estoques
          SET quantidade = quantidade - v_ped_item.quantidade,
              quantidade_reservada = GREATEST(0, quantidade_reservada - v_ped_item.quantidade),
              updated_at = now()
          WHERE id = v_estoque.id;
        ELSE
          -- Se estava pendente, confirma o pedido e baixa físico do depósito
          UPDATE public.estoques
          SET quantidade = quantidade - v_ped_item.quantidade,
              updated_at = now()
          WHERE id = v_estoque.id;
        END IF;

        -- Registrar movimentação
        INSERT INTO public.movimentacoes_estoque (
          empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id
        ) VALUES (
          v_empresa_id, v_ped_item.produto_id, 'transferencia_saida', v_ped_item.quantidade,
          'Carga Pedido Rota #' || v_rota.numero || ' - Veículo ' || v_veiculo.identificacao,
          v_pedido_id, v_usuario_id
        );

        -- Registrar em rota_itens_estoque
        INSERT INTO public.rota_itens_estoque (
          empresa_id, rota_id, produto_id, quantidade_carregada
        ) VALUES (
          v_empresa_id, v_rota.id, v_ped_item.produto_id, v_ped_item.quantidade
        )
        ON CONFLICT (rota_id, produto_id) DO UPDATE
        SET quantidade_carregada = rota_itens_estoque.quantidade_carregada + EXCLUDED.quantidade_carregada,
            updated_at = now();
      END LOOP;

      -- Atualizar pedido para confirmado (a caminho na rota)
      UPDATE public.pedidos
      SET status = 'confirmado', updated_at = now()
      WHERE id = v_pedido_id;

      -- Inserir em rota_pedidos
      INSERT INTO public.rota_pedidos (
        empresa_id, rota_id, pedido_id, ordem_entrega, status_entrega
      ) VALUES (
        v_empresa_id, v_rota.id, v_pedido_id, v_ordem, 'pendente'
      )
      ON CONFLICT (rota_id, pedido_id) DO NOTHING;

      v_ordem := v_ordem + 1;
      v_ped_count := v_ped_count + 1;
    END LOOP;
  END IF;

  -- 6. Atualizar status da rota para 'em_andamento'
  UPDATE public.rotas
  SET status = 'em_andamento',
      horario_saida = COALESCE(horario_saida, now()),
      updated_at = now()
  WHERE id = p_rota_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'rota_id', p_rota_id,
    'numero', v_rota.numero,
    'status', 'em_andamento',
    'total_cestas_carregadas', v_total_cestas_carga,
    'pedidos_vinculados', v_ped_count,
    'horario_saida', now()
  );
END;
$$;

-- ============================================================================
-- 6. RPC 2: vender_na_rua
-- ============================================================================
-- Assinatura: vender_na_rua(p_rota_id uuid, p_cliente_id uuid, p_itens jsonb, p_forma_pagamento text, p_condicao text, p_pagamentos jsonb, p_entrada_valor numeric, p_num_parcelas integer, p_intervalo_dias integer, p_observacoes text)
-- - Baixa do estoque do CARRO da rota em_andamento (tabela rota_itens_estoque) do usuário (sem baixa duplicada do depósito)
-- - À vista dividida ou parcelada com as mesmas regras/parcelas/limite de crédito de finalizar_venda
-- - Vendedor/entregador só vende da própria rota em_andamento (ou gerente/admin)
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
  v_disponivel_carro numeric;
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

  -- Validar e calcular estoque do CARRO (tabela rota_itens_estoque)
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

    -- Disponível no carro = carregada - (vendida + entregue + devolvida)
    v_disponivel_carro := v_estoque_carro.quantidade_carregada - (
      v_estoque_carro.quantidade_vendida + v_estoque_carro.quantidade_entregue + v_estoque_carro.quantidade_devolvida
    );

    IF v_disponivel_carro < v_quantidade THEN
      RAISE EXCEPTION 'Estoque no veículo insuficiente para venda na rua (disponível no carro: %, solicitado: %).',
        v_disponivel_carro, v_quantidade;
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

    -- CORREÇÃO DE SEGURANÇA: Estouro de limite na rua só aceito se QUEM ESTÁ LOGADO for master/admin/gerente
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

    -- Atualizar quantidade_vendida na rota (NÃO toca estoques do depósito para não duplicar baixa!)
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

-- ============================================================================
-- 7. RPC 3: concluir_entrega_pedido_rota
-- ============================================================================
-- Assinatura: concluir_entrega_pedido_rota(p_rota_id uuid, p_pedido_id uuid, p_entregue boolean, p_motivo_nao_entrega text, p_pagamentos jsonb, p_forma_pagamento text)
-- - entregue: converte o pedido em venda (pagamento na entrega se houver), baixa do carro (quantidade_entregue em rota_itens_estoque) e liquida a reserva
-- - não entregue: motivo OBRIGATÓRIO, pedido segue confirmado com a cesta no carro
-- - idempotente (mesmo pedido 2x recusado)
CREATE OR REPLACE FUNCTION public.concluir_entrega_pedido_rota(
  p_rota_id uuid,
  p_pedido_id uuid,
  p_entregue boolean,
  p_motivo_nao_entrega text DEFAULT NULL::text,
  p_pagamentos jsonb DEFAULT NULL::jsonb,
  p_forma_pagamento text DEFAULT 'dinheiro'::text
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
  v_rota_ped record;
  v_pedido record;
  v_venda_id uuid;
  v_numero_venda bigint;
  v_item record;
  v_preco_custo numeric;
  v_comissao_percentual numeric(5,2) := 0;
  v_pag jsonb;
  v_soma_pagamentos numeric(14,2) := 0;
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

  -- Travar rota FOR UPDATE
  SELECT * INTO v_rota
  FROM public.rotas
  WHERE id = p_rota_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada.';
  END IF;

  IF v_rota.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'A rota #% não está em andamento (status: %). Não é possível registrar entregas.',
      v_rota.numero, v_rota.status;
  END IF;

  -- Validar se usuário pode operar a rota
  IF v_perfil IN ('vendedor', 'entregador') AND v_rota.responsavel_usuario_id <> v_usuario_id THEN
    RAISE EXCEPTION 'Você só pode registrar entregas na sua própria rota em andamento.';
  END IF;

  -- Travar linha em rota_pedidos
  SELECT * INTO v_rota_ped
  FROM public.rota_pedidos
  WHERE rota_id = p_rota_id AND pedido_id = p_pedido_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este pedido não está vinculado a esta rota.';
  END IF;

  -- Idempotência: se já foi entregue, recusar duplicidade
  IF v_rota_ped.status_entrega = 'entregue' THEN
    RAISE EXCEPTION 'Este pedido já foi registrado como ENTREGUE nesta rota.';
  END IF;

  -- Travar pedido
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  -- CASO 1: NÃO ENTREGUE
  IF NOT p_entregue THEN
    IF p_motivo_nao_entrega IS NULL OR trim(p_motivo_nao_entrega) = '' THEN
      RAISE EXCEPTION 'Motivo é obrigatório quando o pedido não é entregue.';
    END IF;

    UPDATE public.rota_pedidos
    SET status_entrega = 'nao_entregue',
        motivo_nao_entrega = trim(p_motivo_nao_entrega),
        horario_conclusao = now(),
        updated_at = now()
    WHERE id = v_rota_ped.id;

    RETURN jsonb_build_object(
      'sucesso', true,
      'pedido_id', p_pedido_id,
      'status_entrega', 'nao_entregue',
      'motivo', trim(p_motivo_nao_entrega)
    );
  END IF;

  -- CASO 2: ENTREGUE COM SUCESSO
  -- Converter pedido em venda (baixa do carro em rota_itens_estoque)
  PERFORM pg_advisory_xact_lock(hashtext('empresa_venda_' || v_empresa_id::text));

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero_venda
  FROM public.vendas
  WHERE empresa_id = v_empresa_id;

  INSERT INTO public.vendas (
    empresa_id, cliente_id, vendedor_id, numero, subtotal, desconto, total,
    forma_pagamento, status, observacoes, created_by, pedido_id
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    v_empresa_id, v_pedido.cliente_id, v_pedido.vendedor_id, v_numero_venda,
    v_pedido.total, 0, v_pedido.total, lower(p_forma_pagamento), 'finalizada',
    COALESCE(v_pedido.observacoes, '') || ' (Entregue na Rota #' || v_rota.numero || ')',
    v_usuario_id, p_pedido_id
  )
  RETURNING id INTO v_venda_id;

  -- Transferir itens e atualizar quantidade_entregue no carro
  FOR v_item IN
    SELECT ip.produto_id, ip.quantidade, ip.preco_unitario, ip.desconto, ip.subtotal, p.preco_custo
    FROM public.itens_pedido ip
    JOIN public.produtos p ON p.id = ip.produto_id
    WHERE ip.pedido_id = p_pedido_id AND ip.empresa_id = v_empresa_id
  LOOP
    INSERT INTO public.itens_venda (
      empresa_id, venda_id, produto_id, quantidade, preco_unitario, desconto, subtotal, custo_unitario
    ) VALUES (
      v_empresa_id, v_venda_id, v_item.produto_id, v_item.quantidade, v_item.preco_unitario,
      COALESCE(v_item.desconto, 0), v_item.subtotal, COALESCE(v_item.preco_custo, 0)
    );

    -- Atualiza quantidade_entregue no carro
    UPDATE public.rota_itens_estoque
    SET quantidade_entregue = quantidade_entregue + v_item.quantidade,
        updated_at = now()
    WHERE rota_id = p_rota_id AND produto_id = v_item.produto_id;
  END LOOP;

  -- Atualizar status do pedido para 'faturado'
  UPDATE public.pedidos
  SET status = 'faturado', updated_at = now()
  WHERE id = p_pedido_id;

  -- Atualizar rota_pedidos para 'entregue'
  UPDATE public.rota_pedidos
  SET status_entrega = 'entregue',
      motivo_nao_entrega = NULL,
      venda_id = v_venda_id,
      horario_conclusao = now(),
      updated_at = now()
  WHERE id = v_rota_ped.id;

  -- Pagamentos na entrega
  IF p_pagamentos IS NOT NULL AND jsonb_typeof(p_pagamentos) = 'array' AND jsonb_array_length(p_pagamentos) > 0 THEN
    FOR v_pag IN SELECT * FROM jsonb_array_elements(p_pagamentos)
    LOOP
      v_soma_pagamentos := v_soma_pagamentos + (v_pag->>'valor')::numeric;
      INSERT INTO public.venda_pagamentos (
        empresa_id, venda_id, forma, valor, status, data, referencia
      ) VALUES (
        v_empresa_id, v_venda_id, lower(v_pag->>'forma'), (v_pag->>'valor')::numeric,
        COALESCE(v_pag->>'status', 'recebido'), COALESCE((v_pag->>'data')::date, CURRENT_DATE),
        COALESCE(v_pag->>'referencia', 'Entrega Rota #' || v_rota.numero)
      );
    END LOOP;

    IF round(v_soma_pagamentos, 2) <> round(v_pedido.total, 2) THEN
      RAISE EXCEPTION 'A soma dos pagamentos (%) não confere com o total do pedido (%).',
        round(v_soma_pagamentos, 2), round(v_pedido.total, 2);
    END IF;
  ELSE
    -- Pagamento simples integral na entrega
    INSERT INTO public.venda_pagamentos (
      empresa_id, venda_id, forma, valor, status, data, referencia
    ) VALUES (
      v_empresa_id, v_venda_id, lower(p_forma_pagamento), v_pedido.total, 'recebido', CURRENT_DATE,
      'Entrega Rota #' || v_rota.numero
    );
  END IF;

  -- Comissões
  IF v_pedido.vendedor_id IS NOT NULL THEN
    SELECT percentual_comissao INTO v_comissao_percentual
    FROM public.vendedores
    WHERE id = v_pedido.vendedor_id AND empresa_id = v_empresa_id AND ativo = true;

    IF FOUND AND v_comissao_percentual > 0 THEN
      INSERT INTO public.comissoes (
        empresa_id, vendedor_id, venda_id, percentual, valor_venda, valor_comissao, status
      ) VALUES (
        v_empresa_id, v_pedido.vendedor_id, v_venda_id, v_comissao_percentual,
        v_pedido.total, round(v_pedido.total * (v_comissao_percentual / 100), 2), 'pendente'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'pedido_id', p_pedido_id,
    'venda_id', v_venda_id,
    'venda_numero', v_numero_venda,
    'status_entrega', 'entregue'
  );
END;
$$;

-- ============================================================================
-- 8. RPC 4: fechar_rota_acerto
-- ============================================================================
-- Assinatura: fechar_rota_acerto(p_rota_id uuid, p_conferencia jsonb, p_observacoes text)
-- - Conferência do que voltou (cestas físicas conferidas)
-- - Cestas não vendidas e não entregues voltam ao depósito
-- - Reservas de pedidos NÃO entregues voltam a ser reserva no depósito
-- - Divergência esperado × conferido registrada em auditoria_operacoes ('fechamento_rota_divergencia')
-- - Status 'finalizada' + horario_fechamento
-- - Retorna resumo: carregadas/vendidas/entregues/devolvidas, total recebido por forma, total parcelado, parcelas recebidas na rua
-- - Rota finalizada não aceita mais operações
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
  v_veiculo record;
  v_item_estoque record;
  v_conf_item jsonb;
  v_produto_id uuid;
  v_qtd_conferida numeric;
  v_qtd_esperada_retorno numeric;
  v_divergencia numeric := 0;
  v_divergencias jsonb := '[]'::jsonb;
  v_tem_divergencia boolean := false;

  -- Totais de cestas
  v_total_carregadas numeric := 0;
  v_total_vendidas numeric := 0;
  v_total_entregues numeric := 0;
  v_total_devolvidas numeric := 0;

  -- Pedidos não entregues (para devolver suas reservas ao depósito)
  v_ped_nao_entregue record;
  v_ped_item record;

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

  -- 1. Conferir estoque retornado por produto
  FOR v_item_estoque IN
    SELECT *
    FROM public.rota_itens_estoque
    WHERE rota_id = p_rota_id AND empresa_id = v_empresa_id
    FOR UPDATE
  LOOP
    -- O que se esperava retornar = carregada - (vendida + entregue)
    v_qtd_esperada_retorno := v_item_estoque.quantidade_carregada - (
      v_item_estoque.quantidade_vendida + v_item_estoque.quantidade_entregue
    );

    -- Buscar o que foi informado na conferência para este produto
    v_qtd_conferida := v_qtd_esperada_retorno; -- default é o esperado caso não informado
    IF p_conferencia IS NOT NULL AND jsonb_typeof(p_conferencia) = 'array' THEN
      FOR v_conf_item IN SELECT * FROM jsonb_array_elements(p_conferencia)
      LOOP
        IF (v_conf_item->>'produto_id')::uuid = v_item_estoque.produto_id THEN
          v_qtd_conferida := COALESCE((v_conf_item->>'quantidade')::numeric, 0);
        END IF;
      END LOOP;
    END IF;

    v_divergencia := v_qtd_conferida - v_qtd_esperada_retorno;
    IF v_divergencia <> 0 THEN
      v_tem_divergencia := true;
      v_divergencias := v_divergencias || jsonb_build_object(
        'produto_id', v_item_estoque.produto_id,
        'esperado', v_qtd_esperada_retorno,
        'conferido', v_qtd_conferida,
        'diferenca', v_divergencia
      );
    END IF;

    -- Devolver ao depósito a quantidade conferida que retornou fisicamente
    IF v_qtd_conferida > 0 THEN
      UPDATE public.estoques
      SET quantidade = quantidade + v_qtd_conferida,
          updated_at = now()
      WHERE produto_id = v_item_estoque.produto_id AND empresa_id = v_empresa_id;

      -- Registrar movimentação de retorno/entrada no depósito
      INSERT INTO public.movimentacoes_estoque (
        empresa_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id
      ) VALUES (
        v_empresa_id, v_item_estoque.produto_id, 'transferencia_entrada', v_qtd_conferida,
        'Retorno de Fechamento Rota #' || v_rota.numero,
        v_rota.id, v_usuario_id
      );
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

  -- 2. Restaurar reserva no depósito para pedidos NÃO entregues
  FOR v_ped_nao_entregue IN
    SELECT p.id, p.numero
    FROM public.rota_pedidos rp
    JOIN public.pedidos p ON p.id = rp.pedido_id
    WHERE rp.rota_id = p_rota_id
      AND rp.empresa_id = v_empresa_id
      AND rp.status_entrega IN ('nao_entregue', 'pendente')
  LOOP
    -- Como a cesta do pedido não entregue voltou para o depósito, sua reserva é restaurada no depósito
    FOR v_ped_item IN
      SELECT ip.produto_id, ip.quantidade
      FROM public.itens_pedido ip
      WHERE ip.pedido_id = v_ped_nao_entregue.id AND ip.empresa_id = v_empresa_id
    LOOP
      UPDATE public.estoques
      SET quantidade_reservada = quantidade_reservada + v_ped_item.quantidade,
          updated_at = now()
      WHERE produto_id = v_ped_item.produto_id AND empresa_id = v_empresa_id;
    END LOOP;
  END LOOP;

  -- 3. Registrar auditoria se houve divergência na conferência
  IF v_tem_divergencia THEN
    INSERT INTO public.auditoria_operacoes (
      empresa_id, usuario_id, tipo_operacao, referencia_id, tabela_referencia, motivo, detalhes
    ) VALUES (
      v_empresa_id, v_usuario_id, 'fechamento_rota_divergencia', v_rota.id, 'rotas',
      'Divergência apurada no acerto e conferência de fechamento da rota #' || v_rota.numero,
      jsonb_build_object(
        'rota_numero', v_rota.numero,
        'responsavel_id', v_rota.responsavel_usuario_id,
        'divergencias', v_divergencias
      )
    );
  END IF;

  -- 4. Fechar rota com status 'finalizada' e divergência
  UPDATE public.rotas
  SET status = 'finalizada',
      horario_fechamento = now(),
      divergencia_fechamento = v_divergencias,
      observacoes = COALESCE(p_observacoes, observacoes),
      updated_at = now()
  WHERE id = p_rota_id;

  -- 5. Totalizar financeiro da rota:
  -- A) Total recebido por forma em vendas geradas na rua ou entregas desta rota
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

  -- B) Total parcelado / crediário originado nesta rota
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

  -- C) Parcelas de devedores recebidas pelo responsável da rota durante a jornada da rota
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

-- ============================================================================
-- 9. PERMISSÕES E SEGURANÇA DAS RPCS
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.carregar_veiculo_rota(uuid, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carregar_veiculo_rota(uuid, jsonb, uuid[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.vender_na_rua(uuid, uuid, jsonb, text, text, jsonb, numeric, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vender_na_rua(uuid, uuid, jsonb, text, text, jsonb, numeric, text, integer, integer, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.concluir_entrega_pedido_rota(uuid, uuid, boolean, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_entrega_pedido_rota(uuid, uuid, boolean, text, jsonb, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fechar_rota_acerto(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_rota_acerto(uuid, jsonb, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.finalizar_venda(uuid, uuid, jsonb, numeric, text, date, text, jsonb, text, numeric, text, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_venda(uuid, uuid, jsonb, numeric, text, date, text, jsonb, text, numeric, text, integer, integer, uuid) TO authenticated, service_role;
