-- ============================================================================
-- MIGRATION: 20260923070000_escritas_seguras_rpcs_regras_valores.sql
-- VERSÃO: v0.0.110 - SEGURANÇA: ESCRITAS VIA RPC + REGRAS DE VALORES NO BANCO (RODADA B2)
--
-- 1. DROP DE POLICIES DE ESCRITA DIRETA (INSERT/UPDATE/DELETE) DO PAPEL authenticated EM:
--    - contas_pagar (apenas SELECT permitido para master, admin, gerente)
--    - contas_receber (apenas SELECT permitido para master, admin, gerente)
--    - movimentacoes_estoque (apenas SELECT permitido para master, admin, gerente, operador)
--    - pedidos (remover UPDATE e DELETE direto; criação via criar_pedido; atualizações via RPCs)
--    - compras (remover UPDATE e DELETE direto; criação via criar_compra; confirmação via confirmar_compra; cancelamento via cancelar_compra)
--    - vendas (remover UPDATE direto de status/valores; finalização via finalizar_venda; cancelamento via cancelar_venda)
--
-- 2. REGRAS DE INTEGRIDADE (CHECK CONSTRAINTS):
--    - itens_venda: quantidade > 0, preco_unitario >= 0, desconto >= 0, desconto <= subtotal, custo_unitario >= 0
--    - itens_pedido: quantidade > 0, preco_unitario >= 0, desconto >= 0, desconto <= subtotal
--    - itens_compra: quantidade > 0, preco_unitario >= 0, subtotal >= 0
--    - contas_pagar: valor >= 0, valor_pago >= 0, valor_pago <= valor
--    - contas_receber: valor >= 0, valor_pago >= 0, valor_pago <= valor
--    - vendas: subtotal >= 0, desconto >= 0, total >= 0, desconto <= subtotal
--    - compras: total >= 0, valor_pago >= 0, valor_pago <= total
--    - vendedores: percentual_comissao >= 0 AND percentual_comissao <= 100
--    - comissoes: percentual >= 0 AND percentual <= 100, valor_venda >= 0, valor_comissao >= 0
--    - produtos: preco_custo >= 0, preco_venda >= 0, estoque_minimo >= 0
--    - estoques: quantidade >= 0
--
-- 3. RPCS SECURITY DEFINER COM SEARCH_PATH FIXO E CONTROLE TRANSACIONAL:
--    - criar_titulo_pagar(...)
--    - criar_titulo_receber(...)
--    - atualizar_titulo_pagar(...)
--    - atualizar_titulo_receber(...)
--    - cancelar_titulo_pagar(...)
--    - cancelar_titulo_receber(...)
--    - ajustar_estoque_manual(...) [com motivo obrigatório e saldo >= 0]
--    - atualizar_status_pedido(...)
--    - atualizar_pedido(...)
--    - cancelar_pedido(...)
--    - cancelar_compra(...) [estorna estoque, cancela conta a pagar]
--    - cancelar_venda(...) [estorna estoque, cancela conta a receber, cancela comissão]
--    - endurecimento de finalizar_venda, converter_pedido_em_venda, registrar_pagamento, registrar_recebimento
-- ============================================================================

-- ============================================================================
-- PARTE 1: CHECK CONSTRAINTS DE REGRAS DE VALORES
-- ============================================================================

-- 1.1 itens_venda
ALTER TABLE public.itens_venda DROP CONSTRAINT IF EXISTS chk_itens_venda_quantidade;
ALTER TABLE public.itens_venda ADD CONSTRAINT chk_itens_venda_quantidade CHECK (quantidade > 0);

ALTER TABLE public.itens_venda DROP CONSTRAINT IF EXISTS chk_itens_venda_preco_unitario;
ALTER TABLE public.itens_venda ADD CONSTRAINT chk_itens_venda_preco_unitario CHECK (preco_unitario >= 0);

ALTER TABLE public.itens_venda DROP CONSTRAINT IF EXISTS chk_itens_venda_custo_unitario;
ALTER TABLE public.itens_venda ADD CONSTRAINT chk_itens_venda_custo_unitario CHECK (custo_unitario >= 0);

ALTER TABLE public.itens_venda DROP CONSTRAINT IF EXISTS chk_itens_venda_desconto;
ALTER TABLE public.itens_venda ADD CONSTRAINT chk_itens_venda_desconto CHECK (desconto >= 0);

ALTER TABLE public.itens_venda DROP CONSTRAINT IF EXISTS chk_itens_venda_subtotal;
ALTER TABLE public.itens_venda ADD CONSTRAINT chk_itens_venda_subtotal CHECK (subtotal >= 0);

-- 1.2 itens_pedido
ALTER TABLE public.itens_pedido DROP CONSTRAINT IF EXISTS chk_itens_pedido_quantidade;
ALTER TABLE public.itens_pedido ADD CONSTRAINT chk_itens_pedido_quantidade CHECK (quantidade > 0);

ALTER TABLE public.itens_pedido DROP CONSTRAINT IF EXISTS chk_itens_pedido_preco_unitario;
ALTER TABLE public.itens_pedido ADD CONSTRAINT chk_itens_pedido_preco_unitario CHECK (preco_unitario >= 0);

ALTER TABLE public.itens_pedido DROP CONSTRAINT IF EXISTS chk_itens_pedido_desconto;
ALTER TABLE public.itens_pedido ADD CONSTRAINT chk_itens_pedido_desconto CHECK (desconto >= 0);

ALTER TABLE public.itens_pedido DROP CONSTRAINT IF EXISTS chk_itens_pedido_subtotal;
ALTER TABLE public.itens_pedido ADD CONSTRAINT chk_itens_pedido_subtotal CHECK (subtotal >= 0);

-- 1.3 itens_compra
ALTER TABLE public.itens_compra DROP CONSTRAINT IF EXISTS chk_itens_compra_quantidade;
ALTER TABLE public.itens_compra ADD CONSTRAINT chk_itens_compra_quantidade CHECK (quantidade > 0);

ALTER TABLE public.itens_compra DROP CONSTRAINT IF EXISTS chk_itens_compra_preco_unitario;
ALTER TABLE public.itens_compra ADD CONSTRAINT chk_itens_compra_preco_unitario CHECK (preco_unitario >= 0);

ALTER TABLE public.itens_compra DROP CONSTRAINT IF EXISTS chk_itens_compra_subtotal;
ALTER TABLE public.itens_compra ADD CONSTRAINT chk_itens_compra_subtotal CHECK (subtotal >= 0);

-- 1.4 contas_pagar
ALTER TABLE public.contas_pagar DROP CONSTRAINT IF EXISTS chk_contas_pagar_valor;
ALTER TABLE public.contas_pagar ADD CONSTRAINT chk_contas_pagar_valor CHECK (valor >= 0);

ALTER TABLE public.contas_pagar DROP CONSTRAINT IF EXISTS chk_contas_pagar_valor_pago;
ALTER TABLE public.contas_pagar ADD CONSTRAINT chk_contas_pagar_valor_pago CHECK (valor_pago >= 0 AND valor_pago <= valor);

-- 1.5 contas_receber
ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS chk_contas_receber_valor;
ALTER TABLE public.contas_receber ADD CONSTRAINT chk_contas_receber_valor CHECK (valor >= 0);

ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS chk_contas_receber_valor_pago;
ALTER TABLE public.contas_receber ADD CONSTRAINT chk_contas_receber_valor_pago CHECK (valor_pago >= 0 AND valor_pago <= valor);

-- 1.6 vendas
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS chk_vendas_subtotal;
ALTER TABLE public.vendas ADD CONSTRAINT chk_vendas_subtotal CHECK (subtotal >= 0);

ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS chk_vendas_desconto;
ALTER TABLE public.vendas ADD CONSTRAINT chk_vendas_desconto CHECK (desconto >= 0 AND desconto <= subtotal);

ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS chk_vendas_total;
ALTER TABLE public.vendas ADD CONSTRAINT chk_vendas_total CHECK (total >= 0);

-- 1.7 compras
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS chk_compras_total;
ALTER TABLE public.compras ADD CONSTRAINT chk_compras_total CHECK (total >= 0);

ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS chk_compras_valor_pago;
ALTER TABLE public.compras ADD CONSTRAINT chk_compras_valor_pago CHECK (valor_pago >= 0 AND valor_pago <= total);

-- 1.8 vendedores & comissoes
ALTER TABLE public.vendedores DROP CONSTRAINT IF EXISTS chk_vendedores_percentual_comissao;
ALTER TABLE public.vendedores ADD CONSTRAINT chk_vendedores_percentual_comissao CHECK (percentual_comissao >= 0 AND percentual_comissao <= 100);

ALTER TABLE public.comissoes DROP CONSTRAINT IF EXISTS chk_comissoes_percentual;
ALTER TABLE public.comissoes ADD CONSTRAINT chk_comissoes_percentual CHECK (percentual >= 0 AND percentual <= 100);

ALTER TABLE public.comissoes DROP CONSTRAINT IF EXISTS chk_comissoes_valor_venda;
ALTER TABLE public.comissoes ADD CONSTRAINT chk_comissoes_valor_venda CHECK (valor_venda >= 0);

ALTER TABLE public.comissoes DROP CONSTRAINT IF EXISTS chk_comissoes_valor_comissao;
ALTER TABLE public.comissoes ADD CONSTRAINT chk_comissoes_valor_comissao CHECK (valor_comissao >= 0);

-- 1.9 produtos
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS chk_produtos_preco_custo;
ALTER TABLE public.produtos ADD CONSTRAINT chk_produtos_preco_custo CHECK (preco_custo >= 0);

ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS chk_produtos_preco_venda;
ALTER TABLE public.produtos ADD CONSTRAINT chk_produtos_preco_venda CHECK (preco_venda >= 0);

ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS chk_produtos_estoque_minimo;
ALTER TABLE public.produtos ADD CONSTRAINT chk_produtos_estoque_minimo CHECK (estoque_minimo >= 0);

-- 1.10 estoques (estoque nunca negativo)
ALTER TABLE public.estoques DROP CONSTRAINT IF EXISTS chk_estoques_quantidade;
ALTER TABLE public.estoques ADD CONSTRAINT chk_estoques_quantidade CHECK (quantidade >= 0);


-- ============================================================================
-- PARTE 2: REMOVER POLICIES DE ESCRITA DIRETA (INSERT / UPDATE / DELETE)
-- ============================================================================

-- 2.1 contas_pagar (apenas SELECT permitido para master, admin, gerente)
DROP POLICY IF EXISTS "contas_pagar_insert_empresa" ON public.contas_pagar;
DROP POLICY IF EXISTS "contas_pagar_update_empresa" ON public.contas_pagar;
DROP POLICY IF EXISTS "contas_pagar_delete_empresa" ON public.contas_pagar;

-- 2.2 contas_receber (apenas SELECT permitido para master, admin, gerente)
DROP POLICY IF EXISTS "contas_receber_insert_empresa" ON public.contas_receber;
DROP POLICY IF EXISTS "contas_receber_update_empresa" ON public.contas_receber;
DROP POLICY IF EXISTS "contas_receber_delete_empresa" ON public.contas_receber;

-- 2.3 movimentacoes_estoque (apenas SELECT permitido para operador ou superior)
DROP POLICY IF EXISTS "movimentacoes_insert_empresa" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_update_empresa" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_delete_empresa" ON public.movimentacoes_estoque;

-- 2.4 estoques (apenas SELECT pelo tenant; escrita somente pelas RPCs do banco)
DROP POLICY IF EXISTS "estoques_insert_empresa" ON public.estoques;
DROP POLICY IF EXISTS "estoques_update_empresa" ON public.estoques;
DROP POLICY IF EXISTS "estoques_delete_empresa" ON public.estoques;

-- 2.5 vendas (remover UPDATE e DELETE direto)
DROP POLICY IF EXISTS "vendas_update_empresa" ON public.vendas;
DROP POLICY IF EXISTS "vendas_delete_empresa" ON public.vendas;

-- 2.6 compras (remover UPDATE direto de compras confirmadas/canceladas; apenas rascunho se mantido via RPC)
DROP POLICY IF EXISTS "compras_update_empresa" ON public.compras;
DROP POLICY IF EXISTS "compras_delete_empresa" ON public.compras;
DROP POLICY IF EXISTS "itens_compra_update_empresa" ON public.itens_compra;
DROP POLICY IF EXISTS "itens_compra_delete_empresa" ON public.itens_compra;

-- 2.7 pedidos (remover UPDATE e DELETE direto da API; transições de status e exclusões somente via RPC)
DROP POLICY IF EXISTS "pedidos_update_empresa" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_delete_empresa" ON public.pedidos;


-- ============================================================================
-- PARTE 3: RPCs DE SEGURANÇA E NEGÓCIO
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 criar_titulo_pagar: Criação manual de contas a pagar
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_titulo_pagar(
    p_descricao text,
    p_valor numeric,
    p_vencimento date,
    p_fornecedor_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_novo_id uuid;
    v_status_ass jsonb;
BEGIN
    v_status_ass := public.get_status_assinatura();
    IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Acesso bloqueado por pendência na assinatura.');
    END IF;

    v_empresa_id := public.get_my_empresa_id();
    v_usuario_id := public.get_my_usuario_id();

    IF v_empresa_id IS NULL OR v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
    END IF;

    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem criar títulos financeiros a pagar.';
    END IF;

    IF p_descricao IS NULL OR trim(p_descricao) = '' THEN
        RAISE EXCEPTION 'A descrição do título a pagar é obrigatória.';
    END IF;

    IF p_valor IS NULL OR p_valor <= 0 THEN
        RAISE EXCEPTION 'O valor do título a pagar deve ser maior que zero.';
    END IF;

    IF p_vencimento IS NULL THEN
        RAISE EXCEPTION 'A data de vencimento é obrigatória.';
    END IF;

    IF p_fornecedor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.fornecedores
            WHERE id = p_fornecedor_id AND empresa_id = v_empresa_id AND ativo = true
        ) THEN
            RAISE EXCEPTION 'Fornecedor inválido ou não pertence à sua empresa.';
        END IF;
    END IF;

    INSERT INTO public.contas_pagar (
        empresa_id,
        fornecedor_id,
        descricao,
        valor,
        vencimento,
        valor_pago,
        status
    )
    VALUES (
        v_empresa_id,
        p_fornecedor_id,
        trim(p_descricao),
        round(p_valor, 2),
        p_vencimento,
        0,
        'pendente'
    )
    RETURNING id INTO v_novo_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'id', v_novo_id,
        'descricao', trim(p_descricao),
        'valor', round(p_valor, 2),
        'vencimento', p_vencimento,
        'status', 'pendente'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.2 criar_titulo_receber: Criação manual de contas a receber
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_titulo_receber(
    p_descricao text,
    p_valor numeric,
    p_vencimento date,
    p_cliente_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_novo_id uuid;
    v_status_ass jsonb;
BEGIN
    v_status_ass := public.get_status_assinatura();
    IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Acesso bloqueado por pendência na assinatura.');
    END IF;

    v_empresa_id := public.get_my_empresa_id();
    v_usuario_id := public.get_my_usuario_id();

    IF v_empresa_id IS NULL OR v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
    END IF;

    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem criar títulos financeiros a receber.';
    END IF;

    IF p_descricao IS NULL OR trim(p_descricao) = '' THEN
        RAISE EXCEPTION 'A descrição do título a receber é obrigatória.';
    END IF;

    IF p_valor IS NULL OR p_valor <= 0 THEN
        RAISE EXCEPTION 'O valor do título a receber deve ser maior que zero.';
    END IF;

    IF p_vencimento IS NULL THEN
        RAISE EXCEPTION 'A data de vencimento é obrigatória.';
    END IF;

    IF p_cliente_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.clientes
            WHERE id = p_cliente_id AND empresa_id = v_empresa_id AND ativo = true
        ) THEN
            RAISE EXCEPTION 'Cliente inválido ou não pertence à sua empresa.';
        END IF;
    END IF;

    INSERT INTO public.contas_receber (
        empresa_id,
        cliente_id,
        descricao,
        valor,
        vencimento,
        valor_pago,
        status
    )
    VALUES (
        v_empresa_id,
        p_cliente_id,
        trim(p_descricao),
        round(p_valor, 2),
        p_vencimento,
        0,
        'pendente'
    )
    RETURNING id INTO v_novo_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'id', v_novo_id,
        'descricao', trim(p_descricao),
        'valor', round(p_valor, 2),
        'vencimento', p_vencimento,
        'status', 'pendente'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.3 atualizar_titulo_pagar: Edição de dados cadastrais de título pendente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_titulo_pagar(
    p_id uuid,
    p_descricao text,
    p_valor numeric,
    p_vencimento date,
    p_fornecedor_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_conta record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem atualizar títulos a pagar.';
    END IF;

    SELECT * INTO v_conta
    FROM public.contas_pagar
    WHERE id = p_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Título a pagar não encontrado.';
    END IF;

    IF v_conta.status IN ('pago', 'cancelado') THEN
        RAISE EXCEPTION 'Não é permitido editar um título a pagar já quitado ou cancelado.';
    END IF;

    IF p_valor < v_conta.valor_pago THEN
        RAISE EXCEPTION 'O novo valor (%) não pode ser inferior ao valor já pago (%).', p_valor, v_conta.valor_pago;
    END IF;

    IF p_fornecedor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.fornecedores
            WHERE id = p_fornecedor_id AND empresa_id = v_empresa_id AND ativo = true
        ) THEN
            RAISE EXCEPTION 'Fornecedor inválido ou pertencente a outra empresa.';
        END IF;
    END IF;

    UPDATE public.contas_pagar
    SET descricao = COALESCE(trim(p_descricao), descricao),
        valor = round(p_valor, 2),
        vencimento = COALESCE(p_vencimento, vencimento),
        fornecedor_id = p_fornecedor_id,
        updated_at = now()
    WHERE id = p_id;

    RETURN jsonb_build_object('sucesso', true, 'id', p_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.4 atualizar_titulo_receber: Edição de dados cadastrais de título pendente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_titulo_receber(
    p_id uuid,
    p_descricao text,
    p_valor numeric,
    p_vencimento date,
    p_cliente_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_conta record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem atualizar títulos a receber.';
    END IF;

    SELECT * INTO v_conta
    FROM public.contas_receber
    WHERE id = p_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Título a receber não encontrado.';
    END IF;

    IF v_conta.status IN ('pago', 'cancelado') THEN
        RAISE EXCEPTION 'Não é permitido editar um título a receber já quitado ou cancelado.';
    END IF;

    IF p_valor < v_conta.valor_pago THEN
        RAISE EXCEPTION 'O novo valor (%) não pode ser inferior ao valor já recebido (%).', p_valor, v_conta.valor_pago;
    END IF;

    IF p_cliente_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.clientes
            WHERE id = p_cliente_id AND empresa_id = v_empresa_id AND ativo = true
        ) THEN
            RAISE EXCEPTION 'Cliente inválido ou pertencente a outra empresa.';
        END IF;
    END IF;

    UPDATE public.contas_receber
    SET descricao = COALESCE(trim(p_descricao), descricao),
        valor = round(p_valor, 2),
        vencimento = COALESCE(p_vencimento, vencimento),
        cliente_id = p_cliente_id,
        updated_at = now()
    WHERE id = p_id;

    RETURN jsonb_build_object('sucesso', true, 'id', p_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.5 cancelar_titulo_pagar: Cancelamento de título a pagar
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_titulo_pagar(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_conta record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem cancelar títulos a pagar.';
    END IF;

    SELECT * INTO v_conta
    FROM public.contas_pagar
    WHERE id = p_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Título a pagar não encontrado.';
    END IF;

    IF v_conta.status = 'cancelado' THEN
        RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Título já se encontra cancelado.');
    END IF;

    IF v_conta.valor_pago > 0 THEN
        RAISE EXCEPTION 'Não é possível cancelar um título que já possui pagamentos registrados (valor pago: %).', v_conta.valor_pago;
    END IF;

    UPDATE public.contas_pagar
    SET status = 'cancelado', updated_at = now()
    WHERE id = p_id;

    RETURN jsonb_build_object('sucesso', true, 'id', p_id, 'status', 'cancelado');
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.6 cancelar_titulo_receber: Cancelamento de título a receber
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_titulo_receber(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_conta record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem cancelar títulos a receber.';
    END IF;

    SELECT * INTO v_conta
    FROM public.contas_receber
    WHERE id = p_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Título a receber não encontrado.';
    END IF;

    IF v_conta.status = 'cancelado' THEN
        RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Título já se encontra cancelado.');
    END IF;

    IF v_conta.valor_pago > 0 THEN
        RAISE EXCEPTION 'Não é possível cancelar um título que já possui recebimentos registrados (valor recebido: %).', v_conta.valor_pago;
    END IF;

    UPDATE public.contas_receber
    SET status = 'cancelado', updated_at = now()
    WHERE id = p_id;

    RETURN jsonb_build_object('sucesso', true, 'id', p_id, 'status', 'cancelado');
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.7 ajustar_estoque_manual: Ajuste de estoque com motivo obrigatório
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ajustar_estoque_manual(
    p_produto_id uuid,
    p_tipo text,
    p_quantidade numeric,
    p_motivo text
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
    v_novo_saldo numeric;
    v_status_ass jsonb;
BEGIN
    v_status_ass := public.get_status_assinatura();
    IF (v_status_ass->>'acesso_permitido')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION '%', COALESCE(v_status_ass->>'motivo_bloqueio', 'Acesso bloqueado por pendência na assinatura.');
    END IF;

    v_empresa_id := public.get_my_empresa_id();
    v_usuario_id := public.get_my_usuario_id();

    IF v_empresa_id IS NULL OR v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
    END IF;

    -- Ajuste manual requer perfil gerente ou superior
    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem realizar ajustes manuais de estoque.';
    END IF;

    IF lower(p_tipo) NOT IN ('entrada', 'saida', 'ajuste') THEN
        RAISE EXCEPTION 'Tipo de movimentação inválido. Permitidos: entrada, saida, ajuste.';
    END IF;

    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
        RAISE EXCEPTION 'A quantidade informada para o ajuste deve ser maior que zero.';
    END IF;

    IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
        RAISE EXCEPTION 'O motivo do ajuste de estoque é obrigatório (mínimo de 3 caracteres).';
    END IF;

    -- Validar produto
    IF NOT EXISTS (
        SELECT 1 FROM public.produtos
        WHERE id = p_produto_id AND empresa_id = v_empresa_id AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Produto não encontrado ou inativo nesta empresa.';
    END IF;

    -- Bloquear linha do estoque
    SELECT * INTO v_estoque
    FROM public.estoques
    WHERE produto_id = p_produto_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_estoque.id IS NULL THEN
        IF lower(p_tipo) IN ('saida') THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto: saldo disponível 0, solicitado %.', p_quantidade;
        END IF;

        v_novo_saldo := p_quantidade;
        INSERT INTO public.estoques (empresa_id, produto_id, quantidade, updated_at)
        VALUES (v_empresa_id, p_produto_id, v_novo_saldo, now());
    ELSE
        IF lower(p_tipo) = 'entrada' THEN
            v_novo_saldo := v_estoque.quantidade + p_quantidade;
        ELSIF lower(p_tipo) = 'saida' THEN
            IF v_estoque.quantidade < p_quantidade THEN
                RAISE EXCEPTION 'Estoque insuficiente para o produto: saldo disponível %, solicitado %.', v_estoque.quantidade, p_quantidade;
            END IF;
            v_novo_saldo := v_estoque.quantidade - p_quantidade;
        ELSE -- 'ajuste' define saldo absoluto ou relativo conforme convenção; tratamos como saldo absoluto
            v_novo_saldo := p_quantidade;
        END IF;

        UPDATE public.estoques
        SET quantidade = v_novo_saldo, updated_at = now()
        WHERE id = v_estoque.id;
    END IF;

    INSERT INTO public.movimentacoes_estoque (
        empresa_id,
        produto_id,
        tipo,
        quantidade,
        motivo,
        usuario_id,
        created_at
    )
    VALUES (
        v_empresa_id,
        p_produto_id,
        lower(p_tipo),
        p_quantidade,
        trim(p_motivo),
        v_usuario_id,
        now()
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'produto_id', p_produto_id,
        'tipo', lower(p_tipo),
        'quantidade', p_quantidade,
        'novo_saldo', v_novo_saldo
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.8 atualizar_status_pedido: Transição segura de status de pedidos
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_status_pedido(
    p_pedido_id uuid,
    p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_pedido record;
    v_status_normalizado text;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    v_status_normalizado := lower(trim(p_status));
    IF v_status_normalizado NOT IN ('pendente', 'confirmado', 'faturado', 'cancelado') THEN
        RAISE EXCEPTION 'Status de pedido inválido: %.', p_status;
    END IF;

    -- Operadores e vendedores podem atualizar pedidos conforme hierarquia
    IF NOT public.is_vendedor_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes para alterar status do pedido.';
    END IF;

    SELECT * INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado.';
    END IF;

    -- Não permitir alterar se já foi convertido em venda
    IF EXISTS (SELECT 1 FROM public.vendas WHERE pedido_id = p_pedido_id) THEN
        RAISE EXCEPTION 'Este pedido já foi convertido na Venda e não pode ter seu status alterado diretamente.';
    END IF;

    IF v_pedido.status = 'cancelado' THEN
        RAISE EXCEPTION 'Não é possível alterar o status de um pedido já cancelado.';
    END IF;

    UPDATE public.pedidos
    SET status = v_status_normalizado, updated_at = now()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'pedido_id', p_pedido_id,
        'novo_status', v_status_normalizado
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.9 atualizar_pedido: Edição de campos de cabeçalho de pedido pendente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_pedido(
    p_pedido_id uuid,
    p_cliente_id uuid DEFAULT NULL::uuid,
    p_vendedor_id uuid DEFAULT NULL::uuid,
    p_observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_pedido record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF NOT public.is_vendedor_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: privilégios insuficientes para editar pedidos.';
    END IF;

    SELECT * INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado.';
    END IF;

    IF v_pedido.status IN ('faturado', 'cancelado') THEN
        RAISE EXCEPTION 'Não é permitido editar pedidos que já foram faturados ou cancelados.';
    END IF;

    IF p_cliente_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.clientes
            WHERE id = p_cliente_id AND empresa_id = v_empresa_id AND ativo = true
        ) THEN
            RAISE EXCEPTION 'Cliente inválido ou pertencente a outra empresa.';
        END IF;
    END IF;

    IF p_vendedor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.vendedores
            WHERE id = p_vendedor_id AND empresa_id = v_empresa_id AND ativo = true
        ) THEN
            RAISE EXCEPTION 'Vendedor inválido ou pertencente a outra empresa.';
        END IF;
    END IF;

    UPDATE public.pedidos
    SET cliente_id = COALESCE(p_cliente_id, cliente_id),
        vendedor_id = COALESCE(p_vendedor_id, vendedor_id),
        observacoes = COALESCE(p_observacoes, observacoes),
        updated_at = now()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object('sucesso', true, 'pedido_id', p_pedido_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.10 excluir_pedido: Exclusão segura de pedido em rascunho/pendente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.excluir_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_pedido record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF NOT public.is_vendedor_or_above() THEN
        RAISE EXCEPTION 'Acesso negado para excluir pedido.';
    END IF;

    SELECT * INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado.';
    END IF;

    IF v_pedido.status = 'faturado' OR EXISTS (SELECT 1 FROM public.vendas WHERE pedido_id = p_pedido_id) THEN
        RAISE EXCEPTION 'Não é possível excluir um pedido que já foi faturado ou convertido em venda.';
    END IF;

    DELETE FROM public.itens_pedido WHERE pedido_id = p_pedido_id AND empresa_id = v_empresa_id;
    DELETE FROM public.pedidos WHERE id = p_pedido_id AND empresa_id = v_empresa_id;

    RETURN jsonb_build_object('sucesso', true, 'pedido_id', p_pedido_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.11 cancelar_compra: Cancelamento com estorno de estoque e financeiro
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_compra(p_compra_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_compra record;
    v_item record;
    v_estoque record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    v_usuario_id := public.get_my_usuario_id();

    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem cancelar compras.';
    END IF;

    SELECT * INTO v_compra
    FROM public.compras
    WHERE id = p_compra_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra não encontrada.';
    END IF;

    -- Idempotência
    IF v_compra.status = 'cancelada' THEN
        RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Compra já cancelada anteriormente.');
    END IF;

    -- Se a compra estava confirmada, realizar o estorno no estoque e financeiro
    IF v_compra.status = 'confirmada' THEN
        -- 1. Validar se há saldo de estoque suficiente para estornar
        FOR v_item IN
            SELECT ic.*, p.nome as produto_nome
            FROM public.itens_compra ic
            JOIN public.produtos p ON p.id = ic.produto_id
            WHERE ic.compra_id = p_compra_id AND ic.empresa_id = v_empresa_id
        LOOP
            SELECT * INTO v_estoque
            FROM public.estoques
            WHERE produto_id = v_item.produto_id AND empresa_id = v_empresa_id
            FOR UPDATE;

            IF v_estoque.id IS NULL OR v_estoque.quantidade < v_item.quantidade THEN
                RAISE EXCEPTION 'Não é possível estornar a compra #%: o produto "%" possui saldo insuficiente (% < %).',
                    v_compra.numero, v_item.produto_nome, COALESCE(v_estoque.quantidade, 0), v_item.quantidade;
            END IF;
        END LOOP;

        -- 2. Executar baixa no estoque e registrar movimentação de saída por estorno
        FOR v_item IN
            SELECT ic.*
            FROM public.itens_compra ic
            WHERE ic.compra_id = p_compra_id AND ic.empresa_id = v_empresa_id
        LOOP
            UPDATE public.estoques
            SET quantidade = quantidade - v_item.quantidade, updated_at = now()
            WHERE produto_id = v_item.produto_id AND empresa_id = v_empresa_id;

            INSERT INTO public.movimentacoes_estoque (
                empresa_id,
                produto_id,
                fornecedor_id,
                tipo,
                quantidade,
                motivo,
                referencia_id,
                usuario_id,
                created_at
            )
            VALUES (
                v_empresa_id,
                v_item.produto_id,
                v_compra.fornecedor_id,
                'saida',
                v_item.quantidade,
                'Estorno do cancelamento da Compra #' || v_compra.numero,
                p_compra_id,
                v_usuario_id,
                now()
            );
        END LOOP;

        -- 3. Cancelar contas a pagar originadas desta compra
        UPDATE public.contas_pagar
        SET status = 'cancelado', updated_at = now()
        WHERE empresa_id = v_empresa_id
          AND fornecedor_id = v_compra.fornecedor_id
          AND descricao ILIKE '%Compra #' || v_compra.numero || '%'
          AND status <> 'cancelado'
          AND valor_pago = 0;
    END IF;

    -- Atualizar status da compra
    UPDATE public.compras
    SET status = 'cancelada', updated_at = now()
    WHERE id = p_compra_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'compra_id', p_compra_id,
        'numero', v_compra.numero,
        'status', 'cancelada'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.12 cancelar_venda: Cancelamento atômico de venda com estorno de estoque, contas e comissão
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_venda(p_venda_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_venda record;
    v_item record;
    v_estoque record;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    v_usuario_id := public.get_my_usuario_id();

    IF NOT public.is_empresa_gerente_or_above() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores e gerentes podem cancelar vendas.';
    END IF;

    SELECT * INTO v_venda
    FROM public.vendas
    WHERE id = p_venda_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venda não encontrada.';
    END IF;

    -- Idempotência
    IF v_venda.status = 'cancelada' THEN
        RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Venda já se encontra cancelada.');
    END IF;

    -- 1. Estornar estoque (devolver quantidade)
    FOR v_item IN
        SELECT iv.*
        FROM public.itens_venda iv
        WHERE iv.venda_id = p_venda_id AND iv.empresa_id = v_empresa_id
    LOOP
        SELECT * INTO v_estoque
        FROM public.estoques
        WHERE produto_id = v_item.produto_id AND empresa_id = v_empresa_id
        FOR UPDATE;

        IF v_estoque.id IS NOT NULL THEN
            UPDATE public.estoques
            SET quantidade = quantidade + v_item.quantidade, updated_at = now()
            WHERE id = v_estoque.id;
        ELSE
            INSERT INTO public.estoques (empresa_id, produto_id, quantidade, updated_at)
            VALUES (v_empresa_id, v_item.produto_id, v_item.quantidade, now());
        END IF;

        INSERT INTO public.movimentacoes_estoque (
            empresa_id,
            produto_id,
            tipo,
            quantidade,
            motivo,
            referencia_id,
            usuario_id,
            created_at
        )
        VALUES (
            v_empresa_id,
            v_item.produto_id,
            'entrada',
            v_item.quantidade,
            'Estorno de cancelamento da Venda #' || v_venda.numero,
            p_venda_id,
            v_usuario_id,
            now()
        );
    END LOOP;

    -- 2. Cancelar título a receber vinculado (se houver e não estiver pago)
    UPDATE public.contas_receber
    SET status = 'cancelado', updated_at = now()
    WHERE venda_id = p_venda_id
      AND empresa_id = v_empresa_id
      AND status <> 'cancelado'
      AND valor_pago = 0;

    -- 3. Cancelar comissão gerada (se houver e pendente)
    UPDATE public.comissoes
    SET status = 'cancelada'
    WHERE venda_id = p_venda_id
      AND empresa_id = v_empresa_id;

    -- 4. Marcar venda como cancelada
    UPDATE public.vendas
    SET status = 'cancelada', updated_at = now()
    WHERE id = p_venda_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'venda_id', p_venda_id,
        'numero', v_venda_id,
        'status', 'cancelada'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.13 atualizar_compra_rascunho: Edição segura de cabeçalho e itens de compra rascunho
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_compra_rascunho(
    p_compra_id uuid,
    p_fornecedor_id uuid,
    p_itens jsonb,
    p_observacoes text DEFAULT NULL::text,
    p_data_compra date DEFAULT CURRENT_DATE,
    p_forma_pagamento text DEFAULT 'a_prazo'::text,
    p_vencimento date DEFAULT NULL::date,
    p_valor_pago numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_compra record;
    v_total numeric := 0;
    v_item jsonb;
    v_subtotal numeric;
BEGIN
    v_empresa_id := public.get_my_empresa_id();
    IF NOT public.is_operador_or_above() THEN
        RAISE EXCEPTION 'Acesso negado para editar compras.';
    END IF;

    SELECT * INTO v_compra
    FROM public.compras
    WHERE id = p_compra_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra não encontrada.';
    END IF;

    IF v_compra.status <> 'rascunho' THEN
        RAISE EXCEPTION 'Apenas compras em rascunho podem ser editadas.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.fornecedores
        WHERE id = p_fornecedor_id AND empresa_id = v_empresa_id AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Fornecedor inválido ou pertencente a outra empresa.';
    END IF;

    -- Se foram enviados itens, substituir os itens antigos
    IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' AND jsonb_array_length(p_itens) > 0 THEN
        DELETE FROM public.itens_compra
        WHERE compra_id = p_compra_id AND empresa_id = v_empresa_id;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
        LOOP
            IF ((v_item->>'quantidade')::numeric) <= 0 THEN
                RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
            END IF;

            IF ((v_item->>'preco_unitario')::numeric) < 0 THEN
                RAISE EXCEPTION 'O preço unitário não pode ser negativo.';
            END IF;

            v_subtotal := round(((v_item->>'quantidade')::numeric * (v_item->>'preco_unitario')::numeric), 2);

            INSERT INTO public.itens_compra (empresa_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
            VALUES (
                v_empresa_id,
                p_compra_id,
                (v_item->>'produto_id')::uuid,
                (v_item->>'quantidade')::numeric,
                (v_item->>'preco_unitario')::numeric,
                v_subtotal
            );

            v_total := v_total + v_subtotal;
        END LOOP;
    ELSE
        -- Mantém o total atual da compra se itens não foram reenviados
        v_total := v_compra.total;
    END IF;

    UPDATE public.compras
    SET fornecedor_id = p_fornecedor_id,
        observacoes = p_observacoes,
        data_compra = p_data_compra,
        forma_pagamento = p_forma_pagamento,
        vencimento = p_vencimento,
        valor_pago = COALESCE(p_valor_pago, 0),
        total = v_total,
        updated_at = now()
    WHERE id = p_compra_id;

    RETURN jsonb_build_object('sucesso', true, 'compra_id', p_compra_id, 'total', v_total);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.14 Endurecimento de finalizar_venda (mensagem clara em PT-BR para estoque insuficiente)
-- ----------------------------------------------------------------------------
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
SET search_path = public
AS $function$
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

    -- 3. VALIDAR LIMITE DE VENDAS DO PLANO NO MÊS CORRENTE
    IF v_limite_vendas_mes IS NOT NULL THEN
        v_primeiro_dia_mes := date_trunc('month', now());

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

    -- 10. CRIAR VENDA
    INSERT INTO public.vendas (
        empresa_id,
        cliente_id,
        vendedor_id,
        subtotal,
        desconto,
        total,
        forma_pagamento,
        status,
        observacoes,
        created_by
    )
    VALUES (
        v_empresa_id,
        p_cliente_id,
        p_vendedor_id,
        v_subtotal,
        p_desconto,
        v_total,
        lower(p_forma_pagamento),
        'finalizada',
        p_observacoes,
        v_usuario_id
    )
    RETURNING id, numero
    INTO v_venda_id, v_numero;

    -- 11. INSERIR ITENS + BAIXAR ESTOQUE
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

    -- 12. FINANCEIRO
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
            COALESCE(p_vencimento, current_date),
            'pendente'
        );
    END IF;

    -- 13. COMISSÃO
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
$function$;

-- ----------------------------------------------------------------------------
-- 3.15 Conceder privilégios de execução das novas funções
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.criar_titulo_pagar(text, numeric, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.criar_titulo_receber(text, numeric, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_titulo_pagar(uuid, text, numeric, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_titulo_receber(uuid, text, numeric, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_titulo_pagar(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_titulo_receber(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ajustar_estoque_manual(uuid, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_status_pedido(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_pedido(uuid, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_pedido(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_compra(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_venda(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_compra_rascunho(uuid, uuid, jsonb, text, date, text, date, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_venda(uuid, uuid, jsonb, numeric, text, date, text) TO authenticated, service_role;
