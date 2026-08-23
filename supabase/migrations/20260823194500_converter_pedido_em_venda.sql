-- Migration: RPC public.converter_pedido_em_venda
-- Converte um pedido com status 'faturado' em venda, baixando estoque, gerando movimentação, financeiro (se fiado) e comissão.

CREATE OR REPLACE FUNCTION public.converter_pedido_em_venda(
    p_pedido_id uuid,
    p_forma_pagamento text DEFAULT 'pix',
    p_vencimento date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_perfil text;

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
begin
    -- 1. Identificar usuário e empresa
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

    -- 2. Validar permissão
    if not public.is_vendedor_or_above() then
        raise exception 'Usuário não possui permissão para converter pedidos em venda.';
    end if;

    -- 3. Validar forma de pagamento
    if lower(p_forma_pagamento) not in (
        'dinheiro',
        'pix',
        'cartao',
        'fiado'
    ) then
        raise exception 'Forma de pagamento inválida.';
    end if;

    -- 4. Bloquear e validar pedido
    select *
    into v_pedido
    from public.pedidos
    where id = p_pedido_id
      and empresa_id = v_empresa_id
    for update;

    if not found then
        raise exception 'Pedido não encontrado.';
    end if;

    if v_pedido.status = 'cancelado' then
        raise exception 'Não é possível converter um pedido cancelado.';
    end if;

    if v_pedido.status <> 'faturado' then
        raise exception 'Apenas pedidos com status "faturado" podem ser convertidos em venda.';
    end if;

    if v_pedido.observacoes is not null and v_pedido.observacoes like '%[Venda #%' then
        raise exception 'Este pedido já foi convertido em venda.';
    end if;

    -- 5. Validar cliente do pedido (se houver)
    if v_pedido.cliente_id is not null then
        if not exists (
            select 1
            from public.clientes c
            where c.id = v_pedido.cliente_id
              and c.empresa_id = v_empresa_id
              and c.ativo = true
        ) then
            raise exception 'Cliente do pedido não está mais ativo ou pertence a outra empresa.';
        end if;
    end if;

    -- 6. Validar vendedor do pedido (se houver)
    if v_pedido.vendedor_id is not null then
        select percentual_comissao
        into v_comissao_percentual
        from public.vendedores
        where id = v_pedido.vendedor_id
          and empresa_id = v_empresa_id
          and ativo = true;

        if not found then
            raise exception 'Vendedor do pedido não está mais ativo ou pertence a outra empresa.';
        end if;
    end if;

    -- 7. Buscar e validar itens do pedido + 8. Totais + 9. Validar estoque (com FOR UPDATE)
    for v_item in
        select
            ip.id as item_id,
            ip.produto_id,
            ip.quantidade,
            ip.preco_unitario,
            ip.desconto,
            ip.subtotal,
            p.nome as produto_nome,
            p.ativo as produto_ativo,
            p.empresa_id as produto_empresa_id
        from public.itens_pedido ip
        join public.produtos p on ip.produto_id = p.id
        where ip.pedido_id = p_pedido_id
          and ip.empresa_id = v_empresa_id
    loop
        v_qtd_itens := v_qtd_itens + 1;

        if not v_item.produto_ativo or v_item.produto_empresa_id <> v_empresa_id then
            raise exception 'Produto % não está mais ativo ou pertence a outra empresa.', v_item.produto_nome;
        end if;

        if v_item.quantidade is null or v_item.quantidade <= 0 then
            raise exception 'Quantidade inválida para o produto %.', v_item.produto_nome;
        end if;

        -- Bloquear e validar estoque
        select quantidade
        into v_estoque
        from public.estoques
        where produto_id = v_item.produto_id
          and empresa_id = v_empresa_id
        for update;

        if v_estoque is null then
            raise exception 'Produto % não possui estoque cadastrado.', v_item.produto_nome;
        end if;

        if v_estoque < v_item.quantidade then
            raise exception 'Estoque insuficiente para o produto %. Estoque atual: %, solicitado: %.',
                v_item.produto_nome,
                v_estoque,
                v_item.quantidade;
        end if;

        -- Acumular totais usando os valores originais de itens_pedido
        v_subtotal := v_subtotal + round(v_item.quantidade * v_item.preco_unitario, 2);
        v_desconto := v_desconto + coalesce(v_item.desconto, 0);
        v_total := v_total + v_item.subtotal;
    end loop;

    if v_qtd_itens = 0 then
        raise exception 'Pedido não possui itens.';
    end if;

    -- 10. Inserir venda
    v_obs_venda := 'Convertido do Pedido #' || v_pedido.numero || coalesce('. ' || v_pedido.observacoes, '');

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
        v_pedido.cliente_id,
        v_pedido.vendedor_id,
        v_subtotal,
        v_desconto,
        v_total,
        lower(p_forma_pagamento),
        'finalizada',
        v_obs_venda,
        v_usuario_id
    )
    returning id, numero
    into v_venda_id, v_numero;

    -- 11. Inserir itens_venda + baixar estoque + movimentações
    for v_item in
        select
            ip.produto_id,
            ip.quantidade,
            ip.preco_unitario,
            ip.desconto,
            ip.subtotal
        from public.itens_pedido ip
        where ip.pedido_id = p_pedido_id
          and ip.empresa_id = v_empresa_id
    loop
        insert into public.itens_venda (
            empresa_id,
            venda_id,
            produto_id,
            quantidade,
            preco_unitario,
            desconto,
            subtotal
        )
        values (
            v_empresa_id,
            v_venda_id,
            v_item.produto_id,
            v_item.quantidade,
            v_item.preco_unitario,
            coalesce(v_item.desconto, 0),
            v_item.subtotal
        );

        update public.estoques
        set
            quantidade = quantidade - v_item.quantidade,
            updated_at = now()
        where produto_id = v_item.produto_id
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
            v_item.produto_id,
            'saida',
            v_item.quantidade,
            'Venda #' || v_numero,
            v_venda_id,
            v_usuario_id
        );
    end loop;

    -- 12. Financeiro (se fiado)
    if lower(p_forma_pagamento) = 'fiado' then
        if v_pedido.cliente_id is null then
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
            v_pedido.cliente_id,
            v_venda_id,
            'Venda #' || v_numero,
            v_total,
            coalesce(p_vencimento, current_date),
            'pendente'
        );
    end if;

    -- 13. Comissão
    if v_pedido.vendedor_id is not null and v_comissao_percentual > 0 then
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
            v_pedido.vendedor_id,
            v_venda_id,
            v_comissao_percentual,
            v_total,
            v_valor_comissao,
            'pendente'
        );
    end if;

    -- 14. Atualizar pedido (mantendo status 'faturado')
    update public.pedidos
    set
        observacoes = case
            when observacoes is null or observacoes = '' then '[Venda #' || v_numero || ']'
            else '[Venda #' || v_numero || '] ' || observacoes
        end,
        updated_at = now()
    where id = p_pedido_id;

    -- 15. Retorno
    return jsonb_build_object(
        'sucesso', true,
        'pedido_id', p_pedido_id,
        'numero_pedido', v_pedido.numero,
        'venda_id', v_venda_id,
        'numero_venda', v_numero,
        'subtotal', v_subtotal,
        'desconto', v_desconto,
        'total', v_total,
        'forma_pagamento', lower(p_forma_pagamento),
        'comissao', coalesce(v_valor_comissao, 0)
    );

exception
    when others then
        raise;
end;
$$;
