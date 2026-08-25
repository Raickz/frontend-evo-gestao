-- Migration: 20260830000000_validar_limites_plano_rpcs.sql
-- Validação de limites de produtos e vendas no plano da empresa nas RPCs criar_produto e finalizar_venda

-- 1. Atualizar RPC criar_produto com validação de limite de produtos do plano
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
    p_descricao text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_produto_id uuid;
    v_limite_produtos integer;
    v_produtos_ativos_count integer;
begin
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

    -- ========================================================
    -- VALIDAR LIMITE DE PRODUTOS DO PLANO
    -- ========================================================
    select p.limite_produtos
    into v_limite_produtos
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    limit 1;

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
        estoque_minimo
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
        p_estoque_minimo
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
        'estoque_inicial', p_estoque_inicial
    );

end;
$function$;


-- 2. Atualizar RPC finalizar_venda com validação de limite de vendas/mês do plano
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
AS $function$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_perfil text;

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

    v_comissao_percentual numeric(5,2) := 0;
    v_valor_comissao numeric(14,2) := 0;

begin

    -- ========================================================
    -- 1. IDENTIFICAR USUÁRIO AUTENTICADO
    -- ========================================================

    select
        u.id,
        u.empresa_id,
        u.perfil
    into
        v_usuario_id,
        v_empresa_id,
        v_perfil
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.ativo = true
    limit 1;

    if v_usuario_id is null then
        raise exception 'Usuário não autenticado ou inativo.';
    end if;

    if v_empresa_id is null then
        raise exception 'Usuário não está vinculado a uma empresa.';
    end if;


    -- ========================================================
    -- 2. VALIDAR PERMISSÃO
    -- ========================================================

    if v_perfil not in (
        'master',
        'admin',
        'gerente',
        'vendedor'
    ) then
        raise exception 'Usuário não possui permissão para realizar vendas.';
    end if;


    -- ========================================================
    -- 3. VALIDAR LIMITE DE VENDAS DO PLANO NO MÊS CORRENTE
    -- ========================================================

    select p.limite_vendas_mes
    into v_limite_vendas_mes
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    limit 1;

    if v_limite_vendas_mes is not null then
        v_primeiro_dia_mes := date_trunc('month', now());

        select count(*)
        into v_vendas_mes_count
        from public.vendas
        where empresa_id = v_empresa_id
          and status = 'finalizada'
          and created_at >= v_primeiro_dia_mes;

        if v_vendas_mes_count >= v_limite_vendas_mes then
            raise exception 'Limite de vendas do plano atingido para este mês. Faça upgrade do seu plano para aumentar sua capacidade.';
        end if;
    end if;


    -- ========================================================
    -- 4. VALIDAR FORMA DE PAGAMENTO
    -- ========================================================

    if lower(p_forma_pagamento) not in (
        'dinheiro',
        'pix',
        'cartao',
        'fiado'
    ) then
        raise exception 'Forma de pagamento inválida.';
    end if;


    -- ========================================================
    -- 5. VALIDAR CLIENTE
    -- ========================================================

    if p_cliente_id is not null then
        if not exists (
            select 1
            from public.clientes c
            where c.id = p_cliente_id
              and c.empresa_id = v_empresa_id
              and c.ativo = true
        ) then
            raise exception 'Cliente inválido ou pertencente a outra empresa.';
        end if;
    end if;


    -- ========================================================
    -- 6. VALIDAR VENDEDOR
    -- ========================================================

    if p_vendedor_id is not null then
        select percentual_comissao
        into v_comissao_percentual
        from public.vendedores
        where id = p_vendedor_id
          and empresa_id = v_empresa_id
          and ativo = true;

        if not found then
            raise exception 'Vendedor inválido ou pertencente a outra empresa.';
        end if;
    end if;


    -- ========================================================
    -- 7. VALIDAR ITENS
    -- ========================================================

    if p_itens is null
       or jsonb_typeof(p_itens) <> 'array'
       or jsonb_array_length(p_itens) = 0 then
        raise exception 'A venda precisa possuir pelo menos um produto.';
    end if;


    -- ========================================================
    -- 8. CALCULAR VENDA E VALIDAR ESTOQUE
    -- ========================================================

    for v_item in
        select *
        from jsonb_array_elements(p_itens)
    loop
        v_produto_id := (v_item ->> 'produto_id')::uuid;
        v_quantidade := (v_item ->> 'quantidade')::numeric;

        if v_quantidade is null
           or v_quantidade <= 0 then
            raise exception 'Quantidade inválida para um dos produtos.';
        end if;

        -- BUSCAR PRODUTO E PREÇO DIRETAMENTE DO BANCO
        select p.preco_venda
        into v_preco
        from public.produtos p
        where p.id = v_produto_id
          and p.empresa_id = v_empresa_id
          and p.ativo = true
        for update;

        if not found then
            raise exception 'Produto % não existe ou pertence a outra empresa.', v_produto_id;
        end if;

        -- BLOQUEAR REGISTRO DE ESTOQUE
        select quantidade
        into v_estoque
        from public.estoques
        where produto_id = v_produto_id
          and empresa_id = v_empresa_id
        for update;

        if v_estoque is null then
            raise exception 'Produto % não possui estoque cadastrado.', v_produto_id;
        end if;

        if v_estoque < v_quantidade then
            raise exception 'Estoque insuficiente para o produto %. Estoque atual: %, solicitado: %.',
                v_produto_id,
                v_estoque,
                v_quantidade;
        end if;

        -- CALCULAR SUBTOTAL
        v_subtotal_item := round(v_quantidade * v_preco, 2);
        v_subtotal := v_subtotal + v_subtotal_item;
    end loop;


    -- ========================================================
    -- 9. VALIDAR DESCONTO
    -- ========================================================

    if p_desconto is null then
        p_desconto := 0;
    end if;

    if p_desconto < 0 then
        raise exception 'Desconto não pode ser negativo.';
    end if;

    if p_desconto > v_subtotal then
        raise exception 'Desconto não pode ser maior que o subtotal.';
    end if;

    v_total := round(v_subtotal - p_desconto, 2);


    -- ========================================================
    -- 10. CRIAR VENDA
    -- ========================================================

    insert into public.vendas (
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
    values (
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
    returning id, numero
    into v_venda_id, v_numero;


    -- ========================================================
    -- 11. INSERIR ITENS + BAIXAR ESTOQUE
    -- ========================================================

    for v_item in
        select *
        from jsonb_array_elements(p_itens)
    loop
        v_produto_id := (v_item ->> 'produto_id')::uuid;
        v_quantidade := (v_item ->> 'quantidade')::numeric;

        -- Buscar novamente o preço oficial e preco_custo
        select preco_venda, preco_custo
        into v_preco, v_preco_custo
        from public.produtos
        where id = v_produto_id
          and empresa_id = v_empresa_id
        for update;

        v_subtotal_item := round(v_quantidade * v_preco, 2);

        insert into public.itens_venda (
            empresa_id,
            venda_id,
            produto_id,
            quantidade,
            preco_unitario,
            desconto,
            subtotal,
            custo_unitario
        )
        values (
            v_empresa_id,
            v_venda_id,
            v_produto_id,
            v_quantidade,
            v_preco,
            0,
            v_subtotal_item,
            v_preco_custo
        );

        update public.estoques
        set
            quantidade = quantidade - v_quantidade,
            updated_at = now()
        where produto_id = v_produto_id
          and empresa_id = v_empresa_id;

        insert into public.movimentacoes_estoque (
            empresa_id,
            produto_id,
            tipo,
            quantidade,
            motivo,
            referencia_id,
            usuario_id
        )
        values (
            v_empresa_id,
            v_produto_id,
            'saida',
            v_quantidade,
            'Venda #' || v_numero,
            v_venda_id,
            v_usuario_id
        );
    end loop;


    -- ========================================================
    -- 12. FINANCEIRO
    -- ========================================================

    if lower(p_forma_pagamento) = 'fiado' then
        if p_cliente_id is null then
            raise exception 'Venda fiada precisa possuir um cliente.';
        end if;

        insert into public.contas_receber (
            empresa_id,
            cliente_id,
            venda_id,
            descricao,
            valor,
            vencimento,
            status
        )
        values (
            v_empresa_id,
            p_cliente_id,
            v_venda_id,
            'Venda #' || v_numero,
            v_total,
            coalesce(p_vencimento, current_date),
            'pendente'
        );
    end if;


    -- ========================================================
    -- 13. COMISSÃO
    -- ========================================================

    if p_vendedor_id is not null
       and v_comissao_percentual > 0 then
        v_valor_comissao := round(v_total * (v_comissao_percentual / 100), 2);

        insert into public.comissoes (
            empresa_id,
            vendedor_id,
            venda_id,
            percentual,
            valor_venda,
            valor_comissao,
            status
        )
        values (
            v_empresa_id,
            p_vendedor_id,
            v_venda_id,
            v_comissao_percentual,
            v_total,
            v_valor_comissao,
            'pendente'
        );
    end if;


    -- ========================================================
    -- 14. RETORNO
    -- ========================================================

    return jsonb_build_object(
        'sucesso', true,
        'venda_id', v_venda_id,
        'numero', v_numero,
        'subtotal', v_subtotal,
        'desconto', p_desconto,
        'total', v_total,
        'forma_pagamento', lower(p_forma_pagamento),
        'comissao', v_valor_comissao
    );

end;
$function$;
