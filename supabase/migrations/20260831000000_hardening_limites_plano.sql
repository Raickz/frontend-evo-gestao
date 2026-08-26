-- Migration: 20260831000000_hardening_limites_plano.sql
-- Hardening dos limites de plano: atomicidade (FOR UPDATE nas assinaturas) e novas RPCs (criar_vendedor, criar_cliente, validar_limite_usuarios)

-- ==============================================================================
-- 1. NOVA RPC: criar_vendedor
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.criar_vendedor(
    p_usuario_id uuid DEFAULT NULL::uuid,
    p_nome text DEFAULT NULL::text,
    p_percentual_comissao numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_perfil text;
    v_limite_vendedores integer;
    v_vendedores_ativos_count integer;
    v_vendedor_id uuid;
    v_vendedor_nome text;
    v_assinatura_id uuid;
begin
    -- 1. Obter usuário e empresa autenticados
    select
        id,
        empresa_id,
        perfil
    into
        v_usuario_id,
        v_empresa_id,
        v_perfil
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_empresa_id is null or v_usuario_id is null then
        raise exception 'Usuário não autenticado ou sem empresa vinculada.';
    end if;

    -- 2. Serializar validação de limites travando a linha da assinatura
    select a.id, p.limite_vendedores
    into v_assinatura_id, v_limite_vendedores
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    for update;

    -- 3. Validar permissão (Master, Admin, Gerente)
    if not (
        v_perfil in ('master', 'admin', 'gerente')
        or public.is_manager_or_above()
    ) then
        raise exception 'Usuário não possui permissão para cadastrar vendedores.';
    end if;

    -- 4. Validar dados de entrada
    v_vendedor_nome := trim(coalesce(p_nome, ''));
    if v_vendedor_nome = '' then
        raise exception 'O nome do vendedor é obrigatório.';
    end if;

    if p_percentual_comissao < 0 or p_percentual_comissao > 100 then
        raise exception 'O percentual de comissão deve estar entre 0 e 100.';
    end if;

    -- 5. Se houver usuario_id informado, validar se pertence à mesma empresa e está ativo
    if p_usuario_id is not null then
        if not exists (
            select 1
            from public.usuarios
            where id = p_usuario_id
              and empresa_id = v_empresa_id
              and ativo = true
        ) then
            raise exception 'Usuário vinculado inválido ou pertencente a outra empresa.';
        end if;

        if exists (
            select 1
            from public.vendedores
            where usuario_id = p_usuario_id
        ) then
            raise exception 'Este usuário já está vinculado a outro vendedor.';
        end if;
    end if;

    -- 6. Validar limite de vendedores do plano (contar ativos)
    if v_limite_vendedores is not null then
        select count(*)
        into v_vendedores_ativos_count
        from public.vendedores
        where empresa_id = v_empresa_id
          and ativo = true;

        if v_vendedores_ativos_count >= v_limite_vendedores then
            raise exception 'Limite de vendedores do plano atingido. Faça upgrade do seu plano para adicionar novos vendedores.';
        end if;
    end if;

    -- 7. Inserir vendedor
    insert into public.vendedores (
        empresa_id,
        usuario_id,
        nome,
        percentual_comissao,
        ativo
    )
    values (
        v_empresa_id,
        p_usuario_id,
        v_vendedor_nome,
        coalesce(p_percentual_comissao, 0),
        true
    )
    returning id into v_vendedor_id;

    return jsonb_build_object(
        'sucesso', true,
        'vendedor_id', v_vendedor_id,
        'nome', v_vendedor_nome
    );
end;
$$;


-- ==============================================================================
-- 2. NOVA RPC: criar_cliente
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.criar_cliente(
    p_nome text,
    p_documento text DEFAULT NULL::text,
    p_telefone text DEFAULT NULL::text,
    p_whatsapp text DEFAULT NULL::text,
    p_email text DEFAULT NULL::text,
    p_cep text DEFAULT NULL::text,
    p_estado text DEFAULT NULL::text,
    p_cidade text DEFAULT NULL::text,
    p_endereco text DEFAULT NULL::text,
    p_numero text DEFAULT NULL::text,
    p_bairro text DEFAULT NULL::text,
    p_limite_credito numeric DEFAULT 0,
    p_observacoes text DEFAULT NULL::text,
    p_vendedor_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_perfil text;
    v_limite_clientes integer;
    v_clientes_ativos_count integer;
    v_cliente_id uuid;
    v_cliente_nome text;
    v_assinatura_id uuid;
begin
    -- 1. Obter usuário e empresa autenticados
    select
        id,
        empresa_id,
        perfil
    into
        v_usuario_id,
        v_empresa_id,
        v_perfil
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_empresa_id is null or v_usuario_id is null then
        raise exception 'Usuário não autenticado ou sem empresa vinculada.';
    end if;

    -- 2. Serializar validação de limites travando a linha da assinatura
    select a.id, p.limite_clientes
    into v_assinatura_id, v_limite_clientes
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    for update;

    -- 3. Validar permissão (Master, Admin, Gerente, Vendedor)
    if not (
        v_perfil in ('master', 'admin', 'gerente', 'vendedor')
        or public.is_vendedor_or_above()
    ) then
        raise exception 'Usuário não possui permissão para cadastrar clientes.';
    end if;

    -- 4. Validar dados de entrada
    v_cliente_nome := trim(coalesce(p_nome, ''));
    if v_cliente_nome = '' then
        raise exception 'O nome do cliente é obrigatório.';
    end if;

    if p_limite_credito < 0 then
        raise exception 'O limite de crédito não pode ser negativo.';
    end if;

    -- 5. Se houver vendedor_id informado, validar se pertence à mesma empresa e está ativo
    if p_vendedor_id is not null then
        if not exists (
            select 1
            from public.vendedores
            where id = p_vendedor_id
              and empresa_id = v_empresa_id
              and ativo = true
        ) then
            raise exception 'Vendedor associado inválido ou pertencente a outra empresa.';
        end if;
    end if;

    -- 6. Validar limite de clientes do plano (contar ativos)
    if v_limite_clientes is not null then
        select count(*)
        into v_clientes_ativos_count
        from public.clientes
        where empresa_id = v_empresa_id
          and ativo = true;

        if v_clientes_ativos_count >= v_limite_clientes then
            raise exception 'Limite de clientes do plano atingido. Faça upgrade do seu plano para adicionar novos clientes.';
        end if;
    end if;

    -- 7. Inserir cliente
    insert into public.clientes (
        empresa_id,
        vendedor_id,
        nome,
        documento,
        telefone,
        whatsapp,
        email,
        cep,
        estado,
        cidade,
        endereco,
        numero,
        bairro,
        limite_credito,
        observacoes,
        ativo
    )
    values (
        v_empresa_id,
        p_vendedor_id,
        v_cliente_nome,
        p_documento,
        p_telefone,
        p_whatsapp,
        p_email,
        p_cep,
        p_estado,
        p_cidade,
        p_endereco,
        p_numero,
        p_bairro,
        coalesce(p_limite_credito, 0),
        p_observacoes,
        true
    )
    returning id into v_cliente_id;

    return jsonb_build_object(
        'sucesso', true,
        'cliente_id', v_cliente_id,
        'nome', v_cliente_nome
    );
end;
$$;


-- ==============================================================================
-- 3. NOVA RPC: validar_limite_usuarios
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.validar_limite_usuarios(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limite integer;
  v_count integer;
  v_assinatura_id uuid;
BEGIN
  -- Travar assinatura para serializar a validação e obter limite
  SELECT a.id, p.limite_usuarios 
  INTO v_assinatura_id, v_limite
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = p_empresa_id
    AND a.status IN ('trial','ativa')
  FOR UPDATE;

  IF v_limite IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.usuarios
    WHERE empresa_id = p_empresa_id AND ativo = true;

    IF v_count >= v_limite THEN
      RETURN jsonb_build_object('permitido', false, 'erro', 'Limite de usuários do plano atingido. Faça upgrade do seu plano para adicionar novos usuários.');
    END IF;
  END IF;

  RETURN jsonb_build_object('permitido', true);
END;
$$;


-- ==============================================================================
-- 4. ATUALIZAR RPC: criar_produto (com FOR UPDATE na assinatura no início)
-- ==============================================================================
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
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_produto_id uuid;
    v_limite_produtos integer;
    v_produtos_ativos_count integer;
    v_assinatura_id uuid;
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

    -- ========================================================
    -- VALIDAR LIMITE DE PRODUTOS DO PLANO
    -- ========================================================
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
$$;


-- ==============================================================================
-- 5. ATUALIZAR RPC: finalizar_venda (com FOR UPDATE na assinatura)
-- ==============================================================================
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
declare
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
    -- SERIALIZAR OPERAÇÃO DE LIMITE (FOR UPDATE)
    -- ========================================================
    select a.id, p.limite_vendas_mes
    into v_assinatura_id, v_limite_vendas_mes
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    for update;


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
$$;


-- ==============================================================================
-- 6. ATUALIZAR RPC: converter_pedido_em_venda (com FOR UPDATE e validação de limite de vendas)
-- ==============================================================================
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
declare
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

    -- Serializar operação de limites travando a linha da assinatura
    select a.id, p.limite_vendas_mes
    into v_assinatura_id, v_limite_vendas_mes
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    for update;

    -- 2. Validar permissão
    if not public.is_vendedor_or_above() then
        raise exception 'Usuário não possui permissão para converter pedidos em venda.';
    end if;

    -- 3. Validar limite de vendas do plano no mês corrente
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

    -- 4. Validar forma de pagamento
    if lower(p_forma_pagamento) not in (
        'dinheiro',
        'pix',
        'cartao',
        'fiado'
    ) then
        raise exception 'Forma de pagamento inválida.';
    end if;

    -- 5. Bloquear e validar pedido
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

    -- Verificar se pedido já foi convertido (via relação estrutural)
    perform 1
    from public.vendas
    where pedido_id = p_pedido_id
    for update;

    if found then
        raise exception 'Este pedido já foi convertido em venda.';
    end if;

    -- 6. Validar cliente do pedido (se houver)
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

    -- 7. Validar vendedor do pedido (se houver)
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

    -- 8. Buscar e validar itens do pedido + Totais + Validar estoque (com FOR UPDATE)
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

    -- 9. Inserir venda
    v_obs_venda := 'Convertido do Pedido #' || v_pedido.numero || coalesce('. ' || v_pedido.observacoes, '');

    insert into public.vendas (
        empresa_id,
        cliente_id,
        vendedor_id,
        pedido_id,
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
        p_pedido_id,
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

    -- 10. Inserir itens_venda + baixar estoque + movimentações
    for v_item in
        select
            ip.produto_id,
            ip.quantidade,
            ip.preco_unitario,
            ip.desconto,
            ip.subtotal,
            p.preco_custo
        from public.itens_pedido ip
        join public.produtos p on ip.produto_id = p.id
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
            subtotal,
            custo_unitario
        )
        values (
            v_empresa_id,
            v_venda_id,
            v_item.produto_id,
            v_item.quantidade,
            v_item.preco_unitario,
            coalesce(v_item.desconto, 0),
            v_item.subtotal,
            v_item.preco_custo
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

    -- 11. Financeiro (se fiado)
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

    -- 12. Comissão
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

    -- 13. Atualizar pedido (mantendo status 'faturado')
    update public.pedidos
    set
        observacoes = case
            when observacoes is null or observacoes = '' then '[Venda #' || v_numero || ']'
            else '[Venda #' || v_numero || '] ' || observacoes
        end,
        updated_at = now()
    where id = p_pedido_id;

    -- 14. Retorno
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
