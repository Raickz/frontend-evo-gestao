CREATE OR REPLACE FUNCTION public.criar_pedido(
    p_cliente_id uuid DEFAULT NULL,
    p_vendedor_id uuid DEFAULT NULL,
    p_itens jsonb DEFAULT NULL,
    p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
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
begin
    -- 1. Identificar usuário e empresa
    select id, empresa_id, perfil
    into v_usuario_id, v_empresa_id, v_perfil
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_usuario_id is null then
        raise exception 'Usuário não autenticado ou inativo.';
    end if;

    if v_empresa_id is null then
        raise exception 'Usuário não está vinculado a uma empresa.';
    end if;

    -- 2. Validar permissão
    if not public.is_vendedor_or_above() then
        raise exception 'Usuário não possui permissão para criar pedidos.';
    end if;

    -- 3. Validar cliente
    if p_cliente_id is not null then
        if not exists (
            select 1 from public.clientes
            where id = p_cliente_id
              and empresa_id = v_empresa_id
              and ativo = true
        ) then
            raise exception 'Cliente inválido ou pertence a outra empresa.';
        end if;
    end if;

    -- 4. Validar vendedor
    if p_vendedor_id is not null then
        if not exists (
            select 1 from public.vendedores
            where id = p_vendedor_id
              and empresa_id = v_empresa_id
              and ativo = true
        ) then
            raise exception 'Vendedor inválido ou pertence a outra empresa.';
        end if;
    end if;

    -- 5. Validar itens
    if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
        raise exception 'O pedido precisa ter pelo menos um item.';
    end if;

    -- 6. Gerar número do pedido (com lock para evitar duplicidade)
    perform pg_advisory_xact_lock(hashtext(v_empresa_id::text));

    select coalesce(max(numero), 0) + 1
    into v_numero
    from public.pedidos
    where empresa_id = v_empresa_id;

    -- 7. Inserir pedido com OVERRIDING SYSTEM VALUE
    insert into public.pedidos (empresa_id, cliente_id, vendedor_id, numero, total, status, observacoes)
    overriding system value
    values (v_empresa_id, p_cliente_id, p_vendedor_id, v_numero, 0, 'pendente', p_observacoes)
    returning id into v_pedido_id;

    -- 8. Processar itens
    for v_item in select * from jsonb_array_elements(p_itens)
    loop
        v_produto_id := (v_item ->> 'produto_id')::uuid;
        v_quantidade := (v_item ->> 'quantidade')::numeric;

        if v_quantidade is null or v_quantidade <= 0 then
            raise exception 'Quantidade inválida para um dos produtos.';
        end if;

        -- Buscar preço oficial do banco (ignorar preço enviado pelo frontend)
        select preco_venda into v_preco_unitario
        from public.produtos
        where id = v_produto_id
          and empresa_id = v_empresa_id
          and ativo = true;

        if not found then
            raise exception 'Produto % não existe ou pertence a outra empresa.', v_produto_id;
        end if;

        -- Desconto
        v_desconto := coalesce((v_item ->> 'desconto')::numeric, 0);
        if v_desconto < 0 then
            raise exception 'Desconto não pode ser negativo para o produto %.', v_produto_id;
        end if;

        v_subtotal := round((v_quantidade * v_preco_unitario) - v_desconto, 2);
        if v_subtotal < 0 then
            raise exception 'Desconto não pode ser maior que o valor do item para o produto %.', v_produto_id;
        end if;

        insert into public.itens_pedido (empresa_id, pedido_id, produto_id, quantidade, preco_unitario, desconto, subtotal)
        values (v_empresa_id, v_pedido_id, v_produto_id, v_quantidade, v_preco_unitario, v_desconto, v_subtotal);

        v_total := v_total + v_subtotal;
        v_qtd_itens := v_qtd_itens + 1;
    end loop;

    -- 9. Atualizar total do pedido
    update public.pedidos
    set total = v_total, updated_at = now()
    where id = v_pedido_id;

    -- 10. Retorno
    return jsonb_build_object(
        'sucesso', true,
        'pedido_id', v_pedido_id,
        'numero', v_numero,
        'total', v_total,
        'quantidade_itens', v_qtd_itens,
        'status', 'pendente'
    );

exception
    when others then
        raise;
end;
$function$;
