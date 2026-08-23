-- Migration: Correção da resolução do usuário na RPC registrar_entrada_estoque_por_fornecedor
-- Problema anterior: v_usuario_id recebia auth.uid() (auth.users), violando a FK movimentacoes_estoque.usuario_id -> usuarios.id
-- Solução: Buscar u.id da tabela public.usuarios onde auth_user_id = auth.uid()

CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque_por_fornecedor(
    p_fornecedor_id uuid,
    p_produto_id uuid,
    p_quantidade numeric,
    p_preco_custo numeric,
    p_motivo text DEFAULT 'Entrada de estoque'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_fornecedor record;
    v_produto record;
    v_estoque record;
    v_estoque_anterior numeric;
    v_preco_custo_anterior numeric;
    v_user_role text;
BEGIN
    -- 1. Resolver usuário e empresa via auth.uid()
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não autenticado.');
    END IF;

    SELECT u.id, u.empresa_id INTO v_usuario_id, v_empresa_id
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.ativo = true;

    IF v_usuario_id IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou não possui perfil cadastrado.');
    END IF;

    IF v_empresa_id IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não possui empresa vinculada.');
    END IF;

    -- 2. Verificar permissão (mesma regra da registrar_entrada_estoque: operador ou acima)
    IF NOT public.is_operador_or_above() THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Permissão negada. Apenas operadores ou acima podem registrar entrada de estoque.');
    END IF;

    -- 3. Validar fornecedor
    SELECT f.id, f.nome INTO v_fornecedor
    FROM public.fornecedores f
    WHERE f.id = p_fornecedor_id
      AND f.empresa_id = v_empresa_id
      AND f.ativo = true;

    IF v_fornecedor.id IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Fornecedor inválido ou pertence a outra empresa.');
    END IF;

    -- 4. Validar produto
    SELECT p.id, p.nome, p.preco_custo, p.unidade INTO v_produto
    FROM public.produtos p
    WHERE p.id = p_produto_id
      AND p.empresa_id = v_empresa_id
      AND p.ativo = true;

    IF v_produto.id IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Produto inválido ou pertence a outra empresa.');
    END IF;

    -- 5. Validar quantidade
    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'A quantidade deve ser maior que zero.');
    END IF;

    -- 6. Validar preço de custo
    IF p_preco_custo IS NULL OR p_preco_custo < 0 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'O preço de custo não pode ser negativo.');
    END IF;

    -- 7. Bloquear estoque com FOR UPDATE
    SELECT e.id, e.quantidade INTO v_estoque
    FROM public.estoques e
    WHERE e.produto_id = p_produto_id
      AND e.empresa_id = v_empresa_id
    FOR UPDATE;

    v_estoque_anterior := COALESCE(v_estoque.quantidade, 0);
    v_preco_custo_anterior := COALESCE(v_produto.preco_custo, 0);

    -- 8. Atualizar ou criar estoque
    IF v_estoque.id IS NOT NULL THEN
        UPDATE public.estoques
        SET quantidade = quantidade + p_quantidade,
            updated_at = now()
        WHERE id = v_estoque.id;
    ELSE
        INSERT INTO public.estoques (empresa_id, produto_id, quantidade)
        VALUES (v_empresa_id, p_produto_id, p_quantidade);
    END IF;

    -- 9. Registrar movimentação com fornecedor_id
    INSERT INTO public.movimentacoes_estoque (
        empresa_id, produto_id, fornecedor_id, tipo, quantidade,
        motivo, usuario_id, created_at
    ) VALUES (
        v_empresa_id, p_produto_id, p_fornecedor_id, 'entrada', p_quantidade,
        p_motivo, v_usuario_id, now()
    );

    -- 10. Atualizar preço de custo do produto
    UPDATE public.produtos
    SET preco_custo = p_preco_custo,
        updated_at = now()
    WHERE id = p_produto_id;

    -- 11. Retornar JSON de sucesso
    RETURN jsonb_build_object(
        'sucesso', true,
        'produto_id', p_produto_id,
        'fornecedor_id', p_fornecedor_id,
        'fornecedor_nome', v_fornecedor.nome,
        'produto_nome', v_produto.nome,
        'quantidade_adicionada', p_quantidade,
        'estoque_anterior', v_estoque_anterior,
        'estoque_atual', v_estoque_anterior + p_quantidade,
        'preco_custo_anterior', v_preco_custo_anterior,
        'preco_custo_atual', p_preco_custo
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'sucesso', false,
        'erro', SQLERRM
    );
END;
$$;
