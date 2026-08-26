-- Migration: 20260833000000_controle_trial_status_assinatura.sql
-- Implementar Controle de Trial e Status da Assinatura:
-- 1. RPC get_status_assinatura() (SECURITY DEFINER, search_path = 'public', derivando empresa_id de auth.uid())
-- 2. Proteção nas 12 RPCs operacionais de escrita:
--    criar_produto, criar_cliente, criar_vendedor, finalizar_venda, converter_pedido_em_venda,
--    criar_pedido, criar_compra, registrar_entrada_estoque, registrar_entrada_estoque_por_fornecedor,
--    registrar_pagamento, registrar_recebimento, confirmar_compra
-- 3. Proteção na reativação das 4 RPCs de alteração de status:
--    alterar_status_usuario, alterar_status_vendedor, alterar_status_cliente, alterar_status_produto (apenas quando p_ativo = true)

-- ==============================================================================
-- 1. RPC CENTRALIZADA: get_status_assinatura()
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_status_assinatura()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_assinatura record;
    v_plano record;
    v_dias_restantes integer := 0;
    v_acesso_permitido boolean := false;
    v_motivo_bloqueio text := null;
begin
    -- 1. Obter empresa_id SEMPRE do usuário autenticado via auth.uid()
    select empresa_id
    into v_empresa_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_empresa_id is null then
        return jsonb_build_object(
            'status', 'sem_assinatura',
            'plano_nome', null,
            'plano_slug', null,
            'fim_periodo_teste', null,
            'dias_restantes', 0,
            'acesso_permitido', false,
            'motivo_bloqueio', 'Empresa sem assinatura ativa.'
        );
    end if;

    -- 2. Buscar assinatura e dados do plano da empresa
    select 
        a.id,
        a.status,
        a.fim_periodo_teste,
        a.inicio,
        a.vencimento,
        p.nome as plano_nome,
        p.slug as plano_slug
    into v_assinatura
    from public.assinaturas a
    left join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
    limit 1;

    if v_assinatura.id is null then
        return jsonb_build_object(
            'status', 'sem_assinatura',
            'plano_nome', null,
            'plano_slug', null,
            'fim_periodo_teste', null,
            'dias_restantes', 0,
            'acesso_permitido', false,
            'motivo_bloqueio', 'Empresa sem assinatura ativa.'
        );
    end if;

    -- 3. Calcular dias_restantes para trial
    if v_assinatura.fim_periodo_teste is not null then
        v_dias_restantes := (v_assinatura.fim_periodo_teste - CURRENT_DATE);
    else
        v_dias_restantes := 0;
    end if;

    -- 4. Avaliar acesso_permitido e motivo_bloqueio
    if v_assinatura.status = 'trial' then
        if v_assinatura.fim_periodo_teste is not null and v_assinatura.fim_periodo_teste < CURRENT_DATE then
            v_acesso_permitido := false;
            v_motivo_bloqueio := 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.';
        else
            v_acesso_permitido := true;
            v_motivo_bloqueio := null;
        end if;
    elsif v_assinatura.status in ('cancelada', 'bloqueada') then
        v_acesso_permitido := false;
        v_motivo_bloqueio := 'Sua assinatura foi ' || v_assinatura.status || '. Entre em contato com o suporte EVO Gestão para regularizar.';
    elsif v_assinatura.status in ('ativa', 'pendente', 'atrasada') then
        v_acesso_permitido := true;
        v_motivo_bloqueio := null;
    else
        v_acesso_permitido := false;
        v_motivo_bloqueio := 'Situação da assinatura irregular.';
    end if;

    return jsonb_build_object(
        'status', v_assinatura.status,
        'plano_nome', v_assinatura.plano_nome,
        'plano_slug', v_assinatura.plano_slug,
        'fim_periodo_teste', v_assinatura.fim_periodo_teste,
        'dias_restantes', v_dias_restantes,
        'acesso_permitido', v_acesso_permitido,
        'motivo_bloqueio', v_motivo_bloqueio
    );
end;
$$;


-- ==============================================================================
-- 2. PROTEÇÃO BACKEND NAS RPCs OPERACIONAIS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 2.1 RPC: criar_vendedor
-- ------------------------------------------------------------------------------
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
    v_status_ass jsonb;
begin
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

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


-- ------------------------------------------------------------------------------
-- 2.2 RPC: criar_cliente
-- ------------------------------------------------------------------------------
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
    v_status_ass jsonb;
begin
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

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


-- ------------------------------------------------------------------------------
-- 2.3 RPC: criar_produto
-- ------------------------------------------------------------------------------
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
    v_status_ass jsonb;
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


-- ------------------------------------------------------------------------------
-- 2.4 RPC: finalizar_venda
-- ------------------------------------------------------------------------------
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

    v_status_ass jsonb;
begin
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

    -- 1. IDENTIFICAR USUÁRIO AUTENTICADO
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

    -- SERIALIZAR OPERAÇÃO DE LIMITE (FOR UPDATE)
    select a.id, p.limite_vendas_mes
    into v_assinatura_id, v_limite_vendas_mes
    from public.assinaturas a
    join public.planos p on p.id = a.plano_id
    where a.empresa_id = v_empresa_id
      and a.status in ('trial', 'ativa')
    for update;

    -- 2. VALIDAR PERMISSÃO
    if v_perfil not in (
        'master',
        'admin',
        'gerente',
        'vendedor'
    ) then
        raise exception 'Usuário não possui permissão para realizar vendas.';
    end if;

    -- 3. VALIDAR LIMITE DE VENDAS DO PLANO NO MÊS CORRENTE
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

    -- 4. VALIDAR FORMA DE PAGAMENTO
    if lower(p_forma_pagamento) not in (
        'dinheiro',
        'pix',
        'cartao',
        'fiado'
    ) then
        raise exception 'Forma de pagamento inválida.';
    end if;

    -- 5. VALIDAR CLIENTE
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

    -- 6. VALIDAR VENDEDOR
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

    -- 7. VALIDAR ITENS
    if p_itens is null
       or jsonb_typeof(p_itens) <> 'array'
       or jsonb_array_length(p_itens) = 0 then
        raise exception 'A venda precisa possuir pelo menos um produto.';
    end if;

    -- 8. CALCULAR VENDA E VALIDAR ESTOQUE
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

        v_subtotal_item := round(v_quantidade * v_preco, 2);
        v_subtotal := v_subtotal + v_subtotal_item;
    end loop;

    -- 9. VALIDAR DESCONTO
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

    -- 10. CRIAR VENDA
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

    -- 11. INSERIR ITENS + BAIXAR ESTOQUE
    for v_item in
        select *
        from jsonb_array_elements(p_itens)
    loop
        v_produto_id := (v_item ->> 'produto_id')::uuid;
        v_quantidade := (v_item ->> 'quantidade')::numeric;

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

    -- 12. FINANCEIRO
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

    -- 13. COMISSÃO
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


-- ------------------------------------------------------------------------------
-- 2.5 RPC: converter_pedido_em_venda
-- ------------------------------------------------------------------------------
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

    v_status_ass jsonb;
begin
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

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
end;
$$;


-- ------------------------------------------------------------------------------
-- 2.6 RPC: criar_pedido
-- ------------------------------------------------------------------------------
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
    v_status_ass jsonb;
begin
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

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

        select preco_venda into v_preco_unitario
        from public.produtos
        where id = v_produto_id
          and empresa_id = v_empresa_id
          and ativo = true;

        if not found then
            raise exception 'Produto % não existe ou pertence a outra empresa.', v_produto_id;
        end if;

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

    return jsonb_build_object(
        'sucesso', true,
        'pedido_id', v_pedido_id,
        'numero', v_numero,
        'total', v_total,
        'quantidade_itens', v_qtd_itens,
        'status', 'pendente'
    );
end;
$function$;


-- ------------------------------------------------------------------------------
-- 2.7 RPC: criar_compra
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_compra(
  p_fornecedor_id uuid,
  p_itens jsonb,
  p_observacoes text DEFAULT '',
  p_data_compra date DEFAULT CURRENT_DATE,
  p_forma_pagamento text DEFAULT 'a_prazo',
  p_vencimento date DEFAULT NULL,
  p_valor_pago numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usuario_id uuid;
  v_empresa_id uuid;
  v_compra_id uuid;
  v_total numeric := 0;
  v_numero bigint;
  v_item jsonb;
  v_subtotal numeric;
  v_novo_item_id uuid;
  v_status_ass jsonb;
BEGIN
  -- 0. Validar status da assinatura
  v_status_ass := public.get_status_assinatura();
  if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
    return jsonb_build_object(
      'sucesso', false,
      'erro', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.')
    );
  end if;

  -- 1. Autenticação
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não autenticado.');
  END IF;

  SELECT u.id, u.empresa_id INTO v_usuario_id, v_empresa_id
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true;

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou não possui perfil cadastrado.');
  END IF;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não possui empresa vinculada.');
  END IF;

  -- 2. Permissão
  IF NOT public.is_operador_or_above() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Permissão negada. Você não possui perfil autorizado para criar compras.');
  END IF;

  -- 3. Validar fornecedor
  IF NOT EXISTS (
    SELECT 1 FROM public.fornecedores f
    WHERE f.id = p_fornecedor_id AND f.empresa_id = v_empresa_id AND f.ativo = true
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Fornecedor inválido ou pertence a outra empresa.');
  END IF;

  -- 4. Validar itens
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A compra deve conter pelo menos um item.');
  END IF;

  -- 5. Inserir cabeçalho (rascunho)
  INSERT INTO public.compras (empresa_id, fornecedor_id, total, status, observacoes, data_compra, forma_pagamento, vencimento, valor_pago, created_by)
  VALUES (v_empresa_id, p_fornecedor_id, 0, 'rascunho', p_observacoes, p_data_compra, p_forma_pagamento, p_vencimento, p_valor_pago, v_usuario_id)
  RETURNING id, numero INTO v_compra_id, v_numero;

  -- 6. Inserir itens e calcular total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = (v_item->>'produto_id')::uuid
        AND p.empresa_id = v_empresa_id
        AND p.ativo = true
    ) THEN
      RAISE EXCEPTION 'Produto inválido ou pertence a outra empresa: %', v_item->>'produto_id';
    END IF;

    IF ((v_item->>'quantidade')::numeric) <= 0 THEN
      RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
    END IF;

    IF ((v_item->>'preco_unitario')::numeric) < 0 THEN
      RAISE EXCEPTION 'O preço unitário não pode ser negativo.';
    END IF;

    v_subtotal := ROUND(((v_item->>'quantidade')::numeric * (v_item->>'preco_unitario')::numeric), 2);

    INSERT INTO public.itens_compra (empresa_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_empresa_id, v_compra_id, (v_item->>'produto_id')::uuid, (v_item->>'quantidade')::numeric, (v_item->>'preco_unitario')::numeric, v_subtotal)
    RETURNING id INTO v_novo_item_id;

    v_total := v_total + v_subtotal;
  END LOOP;

  -- 7. Atualizar total
  UPDATE public.compras SET total = v_total WHERE id = v_compra_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'compra_id', v_compra_id,
    'numero', v_numero,
    'total', v_total,
    'status', 'rascunho'
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.8 RPC: confirmar_compra
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmar_compra(
  p_compra_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usuario_id uuid;
  v_empresa_id uuid;
  v_compra record;
  v_item record;
  v_estoque record;
  v_mov_id uuid;
  v_conta_pagar_id uuid;
  v_mov_count integer := 0;
  v_status_atual text;
  v_status_ass jsonb;
BEGIN
  -- 0. Validar status da assinatura
  v_status_ass := public.get_status_assinatura();
  if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
    return jsonb_build_object(
      'sucesso', false,
      'erro', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.')
    );
  end if;

  -- 1. Autenticação
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não autenticado.');
  END IF;

  SELECT u.id, u.empresa_id INTO v_usuario_id, v_empresa_id
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo = true;

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou não possui perfil cadastrado.');
  END IF;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não possui empresa vinculada.');
  END IF;

  -- 2. Permissão
  IF NOT public.is_operador_or_above() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Permissão negada.');
  END IF;

  -- 3. Buscar compra
  SELECT * INTO v_compra FROM public.compras WHERE id = p_compra_id AND empresa_id = v_empresa_id;

  IF v_compra.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Compra não encontrada.');
  END IF;

  IF v_compra.status != 'rascunho' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas compras em rascunho podem ser confirmadas. Status atual: ' || v_compra.status);
  END IF;

  -- 4. Processar cada item
  FOR v_item IN
    SELECT ic.*, p.nome AS produto_nome, p.unidade
    FROM public.itens_compra ic
    JOIN public.produtos p ON p.id = ic.produto_id
    WHERE ic.compra_id = p_compra_id
  LOOP
    SELECT * INTO v_estoque FROM public.estoques
    WHERE produto_id = v_item.produto_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF v_estoque.id IS NULL THEN
      INSERT INTO public.estoques (empresa_id, produto_id, quantidade)
      VALUES (v_empresa_id, v_item.produto_id, v_item.quantidade);
    ELSE
      UPDATE public.estoques SET quantidade = quantidade + v_item.quantidade, updated_at = now()
      WHERE id = v_estoque.id;
    END IF;

    INSERT INTO public.movimentacoes_estoque (
      empresa_id, produto_id, fornecedor_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at
    ) VALUES (
      v_empresa_id, v_item.produto_id, v_compra.fornecedor_id, 'entrada',
      v_item.quantidade,
      'Compra #' || v_compra.numero || ' confirmada',
      p_compra_id, v_usuario_id, now()
    );

    v_mov_count := v_mov_count + 1;

    UPDATE public.produtos SET preco_custo = v_item.preco_unitario, updated_at = now()
    WHERE id = v_item.produto_id;
  END LOOP;

  -- 5. Criar conta a pagar (se a prazo ou valor_pago < total)
  IF v_compra.forma_pagamento = 'a_prazo' AND v_compra.valor_pago < v_compra.total THEN
    INSERT INTO public.contas_pagar (
      empresa_id, fornecedor_id, descricao, valor, vencimento, valor_pago, status
    ) VALUES (
      v_empresa_id, v_compra.fornecedor_id,
      'Compra #' || v_compra.numero,
      v_compra.total,
      COALESCE(v_compra.vencimento, (CURRENT_DATE + INTERVAL '30 days')::date),
      COALESCE(v_compra.valor_pago, 0),
      'pendente'
    )
    RETURNING id INTO v_conta_pagar_id;
  END IF;

  -- 6. Atualizar status da compra
  UPDATE public.compras SET status = 'confirmada', updated_at = now() WHERE id = p_compra_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'compra_id', p_compra_id,
    'numero', v_compra.numero,
    'movimentacoes_criadas', v_mov_count,
    'conta_pagar_id', v_conta_pagar_id
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.9 RPC: registrar_entrada_estoque
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(
    p_produto_id uuid,
    p_quantidade numeric,
    p_motivo text DEFAULT 'Entrada de estoque'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_status_ass jsonb;
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

    if not (
        public.is_admin()
        or public.is_manager_or_above()
        or public.is_operador_or_above()
    ) then
        raise exception 'Usuário não possui permissão para movimentar estoque.';
    end if;

    if p_quantidade <= 0 then
        raise exception 'A quantidade deve ser maior que zero.';
    end if;

    if not exists (
        select 1
        from public.produtos
        where id = p_produto_id
          and empresa_id = v_empresa_id
          and ativo = true
    ) then
        raise exception 'Produto inválido ou pertence a outra empresa.';
    end if;

    update public.estoques
    set
        quantidade = quantidade + p_quantidade,
        updated_at = now()
    where produto_id = p_produto_id
      and empresa_id = v_empresa_id;

    if not found then
        insert into public.estoques (
            empresa_id,
            produto_id,
            quantidade
        )
        values (
            v_empresa_id,
            p_produto_id,
            p_quantidade
        );
    end if;

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
        p_produto_id,
        'entrada',
        p_quantidade,
        p_motivo,
        v_usuario_id
    );

    return jsonb_build_object(
        'sucesso', true,
        'produto_id', p_produto_id,
        'quantidade_adicionada', p_quantidade
    );
end;
$function$;


-- ------------------------------------------------------------------------------
-- 2.10 RPC: registrar_entrada_estoque_por_fornecedor
-- ------------------------------------------------------------------------------
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
    v_status_ass jsonb;
BEGIN
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        return jsonb_build_object(
            'sucesso', false,
            'erro', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.')
        );
    end if;

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

    -- 2. Verificar permissão
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


-- ------------------------------------------------------------------------------
-- 2.11 RPC: registrar_pagamento
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pagamento(
    p_conta_id uuid,
    p_valor_pago numeric,
    p_data_pagamento date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_usuario_id uuid;
    v_empresa_id uuid;
    v_valor numeric;
    v_valor_pago numeric;
    v_status text;
    v_conta_empresa_id uuid;
    v_saldo_restante numeric;
    v_novo_valor_pago numeric;
    v_novo_status text;
    v_status_ass jsonb;
BEGIN
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

    -- 1. Resolver v_empresa_id e v_usuario_id
    SELECT u.id, u.empresa_id
    INTO v_usuario_id, v_empresa_id
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.ativo = true
    LIMIT 1;

    IF v_usuario_id IS NULL OR v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
    END IF;

    -- 2. Validar permissão
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Usuário não possui permissão para realizar baixas financeiras.';
    END IF;

    -- 3. Validar valor pago
    IF p_valor_pago IS NULL OR p_valor_pago <= 0 THEN
        RAISE EXCEPTION 'O valor pago deve ser maior que zero.';
    END IF;

    -- 4. Bloquear a linha e obter dados atuais
    SELECT cp.valor, cp.valor_pago, cp.status, cp.empresa_id
    INTO v_valor, v_valor_pago, v_status, v_conta_empresa_id
    FROM public.contas_pagar cp
    WHERE cp.id = p_conta_id
    FOR UPDATE;

    -- 5. Validar existência e empresa
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta a pagar não encontrada.';
    END IF;

    IF v_conta_empresa_id != v_empresa_id THEN
        RAISE EXCEPTION 'Conta a pagar não pertence à sua empresa.';
    END IF;

    -- 6. Validar status
    IF v_status = 'cancelado' THEN
        RAISE EXCEPTION 'Não é possível pagar uma conta cancelada.';
    END IF;

    IF v_status = 'pago' THEN
        RAISE EXCEPTION 'Esta conta já está totalmente paga.';
    END IF;

    -- 7. Calcular saldo
    v_valor_pago := COALESCE(v_valor_pago, 0);
    v_saldo_restante := v_valor - v_valor_pago;

    -- 8. Validar valor vs saldo
    IF p_valor_pago > v_saldo_restante THEN
        RAISE EXCEPTION 'O valor pago (%) é maior que o saldo restante (%).', p_valor_pago, v_saldo_restante;
    END IF;

    -- 9. Calcular novo valor_pago
    v_novo_valor_pago := v_valor_pago + p_valor_pago;

    -- 10. Determinar novo status
    IF v_novo_valor_pago >= v_valor THEN
        v_novo_status := 'pago';
    ELSE
        v_novo_status := v_status;
    END IF;

    -- 11. UPDATE
    UPDATE public.contas_pagar
    SET valor_pago = v_novo_valor_pago,
        data_pagamento = p_data_pagamento,
        status = v_novo_status,
        updated_at = now()
    WHERE id = p_conta_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'conta_id', p_conta_id,
        'saldo_anterior', v_saldo_restante,
        'valor_pago', p_valor_pago,
        'total_pago', v_novo_valor_pago,
        'saldo_restante', v_valor - v_novo_valor_pago,
        'status', v_novo_status
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.12 RPC: registrar_recebimento
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_recebimento(
    p_conta_id uuid,
    p_valor_recebido numeric,
    p_data_pagamento date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_usuario_id uuid;
    v_empresa_id uuid;
    v_valor numeric;
    v_valor_pago numeric;
    v_status text;
    v_conta_empresa_id uuid;
    v_saldo_restante numeric;
    v_novo_valor_pago numeric;
    v_novo_status text;
    v_status_ass jsonb;
BEGIN
    -- 0. Validar status da assinatura
    v_status_ass := public.get_status_assinatura();
    if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
        raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
    end if;

    -- 1. Resolver v_empresa_id e v_usuario_id
    SELECT u.id, u.empresa_id
    INTO v_usuario_id, v_empresa_id
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.ativo = true
    LIMIT 1;

    IF v_usuario_id IS NULL OR v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
    END IF;

    -- 2. Validar permissão
    IF NOT public.is_manager_or_above() THEN
        RAISE EXCEPTION 'Usuário não possui permissão para realizar baixas financeiras.';
    END IF;

    -- 3. Validar valor recebido
    IF p_valor_recebido IS NULL OR p_valor_recebido <= 0 THEN
        RAISE EXCEPTION 'O valor recebido deve ser maior que zero.';
    END IF;

    -- 4. Bloquear a linha e obter dados atuais
    SELECT cr.valor, cr.valor_pago, cr.status, cr.empresa_id
    INTO v_valor, v_valor_pago, v_status, v_conta_empresa_id
    FROM public.contas_receber cr
    WHERE cr.id = p_conta_id
    FOR UPDATE;

    -- 5. Validar existência e empresa
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta a receber não encontrada.';
    END IF;

    IF v_conta_empresa_id != v_empresa_id THEN
        RAISE EXCEPTION 'Conta a receber não pertence à sua empresa.';
    END IF;

    -- 6. Validar status
    IF v_status = 'cancelado' THEN
        RAISE EXCEPTION 'Não é possível receber uma conta cancelada.';
    END IF;

    IF v_status = 'pago' THEN
        RAISE EXCEPTION 'Esta conta já está totalmente paga.';
    END IF;

    -- 7. Calcular saldo
    v_valor_pago := COALESCE(v_valor_pago, 0);
    v_saldo_restante := v_valor - v_valor_pago;

    -- 8. Validar valor vs saldo
    IF p_valor_recebido > v_saldo_restante THEN
        RAISE EXCEPTION 'O valor recebido (%) é maior que o saldo restante (%).', p_valor_recebido, v_saldo_restante;
    END IF;

    -- 9. Calcular novo valor_pago
    v_novo_valor_pago := v_valor_pago + p_valor_recebido;

    -- 10. Determinar novo status
    IF v_novo_valor_pago >= v_valor THEN
        v_novo_status := 'pago';
    ELSE
        v_novo_status := v_status;
    END IF;

    -- 11. UPDATE
    UPDATE public.contas_receber
    SET valor_pago = v_novo_valor_pago,
        data_pagamento = p_data_pagamento,
        status = v_novo_status,
        updated_at = now()
    WHERE id = p_conta_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'conta_id', p_conta_id,
        'saldo_anterior', v_saldo_restante,
        'valor_recebido', p_valor_recebido,
        'valor_pago', v_novo_valor_pago,
        'saldo_restante', v_valor - v_novo_valor_pago,
        'status', v_novo_status
    );
END;
$$;


-- ==============================================================================
-- 3. PROTEÇÃO NA REATIVAÇÃO DE REGISTROS (alterar_status_*)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 3.1 RPC: alterar_status_usuario
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_status_usuario(
    p_usuario_id uuid,
    p_ativo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_caller_id uuid;
    v_caller_empresa_id uuid;
    v_caller_perfil text;
    v_target_id uuid;
    v_target_empresa_id uuid;
    v_target_perfil text;
    v_target_ativo boolean;
    v_limite_usuarios integer;
    v_usuarios_ativos_count integer;
    v_assinatura_id uuid;
    v_status_ass jsonb;
begin
    -- 1. Obter usuário e empresa autenticados via auth.uid()
    select
        id,
        empresa_id,
        perfil
    into
        v_caller_id,
        v_caller_empresa_id,
        v_caller_perfil
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_caller_id is null or v_caller_empresa_id is null then
        raise exception 'Usuário não autenticado ou inativo.';
    end if;

    -- Validar permissão básica de gerenciamento
    if not (
        v_caller_perfil in ('master', 'admin')
        or public.is_master()
        or public.is_admin()
    ) then
        raise exception 'Você não tem permissão para alterar o status de usuários.';
    end if;

    -- 2. Obter e validar registro alvo
    select
        id,
        empresa_id,
        perfil,
        ativo
    into
        v_target_id,
        v_target_empresa_id,
        v_target_perfil,
        v_target_ativo
    from public.usuarios
    where id = p_usuario_id;

    if v_target_id is null or v_target_empresa_id <> v_caller_empresa_id then
        raise exception 'Usuário alvo não encontrado ou pertence a outra empresa.';
    end if;

    -- Regra de auto-inativação: um usuário NÃO pode inativar a si mesmo
    if v_target_id = v_caller_id and p_ativo = false then
        raise exception 'Você não pode inativar o seu próprio usuário.';
    end if;

    -- Regra Master: Admin NÃO pode inativar/reativar um Master. Só o próprio Master ou usuário com perfil master pode fazer isso.
    if lower(v_target_perfil) = 'master' and lower(v_caller_perfil) <> 'master' then
        raise exception 'Apenas usuários Master podem alterar o status de outro usuário Master.';
    end if;

    -- Se o status já é o solicitado, não há alteração necessária
    if v_target_ativo = p_ativo then
        return jsonb_build_object(
            'sucesso', true,
            'usuario_id', v_target_id,
            'ativo', v_target_ativo
        );
    end if;

    -- Se p_ativo = true (reativação): verificar se assinatura está permitida e checar limite_usuarios
    if p_ativo = true then
        v_status_ass := public.get_status_assinatura();
        if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
            raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
        end if;

        select a.id, p.limite_usuarios
        into v_assinatura_id, v_limite_usuarios
        from public.assinaturas a
        join public.planos p on p.id = a.plano_id
        where a.empresa_id = v_caller_empresa_id
          and a.status in ('trial', 'ativa')
        for update;

        if v_limite_usuarios is not null then
            select count(*)
            into v_usuarios_ativos_count
            from public.usuarios
            where empresa_id = v_caller_empresa_id
              and ativo = true;

            if v_usuarios_ativos_count >= v_limite_usuarios then
                raise exception 'Limite do plano atingido. Seu plano permite até % usuários ativos. Faça upgrade do plano para reativar este registro.', v_limite_usuarios;
            end if;
        end if;
    end if;

    -- Executar o UPDATE
    update public.usuarios
    set
        ativo = p_ativo,
        updated_at = now()
    where id = p_usuario_id;

    return jsonb_build_object(
        'sucesso', true,
        'usuario_id', v_target_id,
        'ativo', p_ativo
    );
end;
$$;


-- ------------------------------------------------------------------------------
-- 3.2 RPC: alterar_status_vendedor
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_status_vendedor(
    p_vendedor_id uuid,
    p_ativo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_caller_id uuid;
    v_caller_empresa_id uuid;
    v_caller_perfil text;
    v_target_id uuid;
    v_target_empresa_id uuid;
    v_target_ativo boolean;
    v_limite_vendedores integer;
    v_vendedores_ativos_count integer;
    v_assinatura_id uuid;
    v_status_ass jsonb;
begin
    -- 1. Obter empresa_id e permissões do auth.uid()
    select
        id,
        empresa_id,
        perfil
    into
        v_caller_id,
        v_caller_empresa_id,
        v_caller_perfil
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_caller_id is null or v_caller_empresa_id is null then
        raise exception 'Usuário não autenticado ou inativo.';
    end if;

    if not (
        v_caller_perfil in ('master', 'admin', 'gerente')
        or public.is_manager_or_above()
    ) then
        raise exception 'Você não possui permissão para gerenciar vendedores.';
    end if;

    -- 2. Validar que o vendedor pertence à mesma empresa
    select
        id,
        empresa_id,
        ativo
    into
        v_target_id,
        v_target_empresa_id,
        v_target_ativo
    from public.vendedores
    where id = p_vendedor_id;

    if v_target_id is null or v_target_empresa_id <> v_caller_empresa_id then
        raise exception 'Vendedor não encontrado ou pertencente a outra empresa.';
    end if;

    if v_target_ativo = p_ativo then
        return jsonb_build_object(
            'sucesso', true,
            'vendedor_id', v_target_id,
            'ativo', v_target_ativo
        );
    end if;

    -- Se p_ativo = true: validar assinatura e limite_vendedores
    if p_ativo = true then
        v_status_ass := public.get_status_assinatura();
        if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
            raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
        end if;

        select a.id, p.limite_vendedores
        into v_assinatura_id, v_limite_vendedores
        from public.assinaturas a
        join public.planos p on p.id = a.plano_id
        where a.empresa_id = v_caller_empresa_id
          and a.status in ('trial', 'ativa')
        for update;

        if v_limite_vendedores is not null then
            select count(*)
            into v_vendedores_ativos_count
            from public.vendedores
            where empresa_id = v_caller_empresa_id
              and ativo = true;

            if v_vendedores_ativos_count >= v_limite_vendedores then
                raise exception 'Limite do plano atingido. Seu plano permite até % vendedores ativos. Faça upgrade do plano para reativar este registro.', v_limite_vendedores;
            end if;
        end if;
    end if;

    -- Executar UPDATE
    update public.vendedores
    set
        ativo = p_ativo
    where id = p_vendedor_id;

    return jsonb_build_object(
        'sucesso', true,
        'vendedor_id', v_target_id,
        'ativo', p_ativo
    );
end;
$$;


-- ------------------------------------------------------------------------------
-- 3.3 RPC: alterar_status_cliente
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_status_cliente(
    p_cliente_id uuid,
    p_ativo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_caller_id uuid;
    v_caller_empresa_id uuid;
    v_caller_perfil text;
    v_target_id uuid;
    v_target_empresa_id uuid;
    v_target_ativo boolean;
    v_limite_clientes integer;
    v_clientes_ativos_count integer;
    v_assinatura_id uuid;
    v_status_ass jsonb;
begin
    -- 1. Obter usuário e empresa autenticados via auth.uid()
    select
        id,
        empresa_id,
        perfil
    into
        v_caller_id,
        v_caller_empresa_id,
        v_caller_perfil
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_caller_id is null or v_caller_empresa_id is null then
        raise exception 'Usuário não autenticado ou inativo.';
    end if;

    if not (
        v_caller_perfil in ('master', 'admin', 'gerente', 'vendedor')
        or public.is_vendedor_or_above()
    ) then
        raise exception 'Você não possui permissão para gerenciar clientes.';
    end if;

    -- 2. Validar que o cliente pertence à mesma empresa
    select
        id,
        empresa_id,
        ativo
    into
        v_target_id,
        v_target_empresa_id,
        v_target_ativo
    from public.clientes
    where id = p_cliente_id;

    if v_target_id is null or v_target_empresa_id <> v_caller_empresa_id then
        raise exception 'Cliente não encontrado ou pertencente a outra empresa.';
    end if;

    if v_target_ativo = p_ativo then
        return jsonb_build_object(
            'sucesso', true,
            'cliente_id', v_target_id,
            'ativo', v_target_ativo
        );
    end if;

    -- Se p_ativo = true: validar assinatura e limite_clientes
    if p_ativo = true then
        v_status_ass := public.get_status_assinatura();
        if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
            raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
        end if;

        select a.id, p.limite_clientes
        into v_assinatura_id, v_limite_clientes
        from public.assinaturas a
        join public.planos p on p.id = a.plano_id
        where a.empresa_id = v_caller_empresa_id
          and a.status in ('trial', 'ativa')
        for update;

        if v_limite_clientes is not null then
            select count(*)
            into v_clientes_ativos_count
            from public.clientes
            where empresa_id = v_caller_empresa_id
              and ativo = true;

            if v_clientes_ativos_count >= v_limite_clientes then
                raise exception 'Limite do plano atingido. Seu plano permite até % clientes ativos. Faça upgrade do plano para reativar este registro.', v_limite_clientes;
            end if;
        end if;
    end if;

    -- Executar UPDATE
    update public.clientes
    set
        ativo = p_ativo,
        updated_at = now()
    where id = p_cliente_id;

    return jsonb_build_object(
        'sucesso', true,
        'cliente_id', v_target_id,
        'ativo', p_ativo
    );
end;
$$;


-- ------------------------------------------------------------------------------
-- 3.4 RPC: alterar_status_produto
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_status_produto(
    p_produto_id uuid,
    p_ativo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_caller_id uuid;
    v_caller_empresa_id uuid;
    v_caller_perfil text;
    v_target_id uuid;
    v_target_empresa_id uuid;
    v_target_ativo boolean;
    v_limite_produtos integer;
    v_produtos_ativos_count integer;
    v_assinatura_id uuid;
    v_status_ass jsonb;
begin
    -- 1. Obter usuário e empresa autenticados via auth.uid()
    select
        id,
        empresa_id,
        perfil
    into
        v_caller_id,
        v_caller_empresa_id,
        v_caller_perfil
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_caller_id is null or v_caller_empresa_id is null then
        raise exception 'Usuário não autenticado ou inativo.';
    end if;

    if not (
        v_caller_perfil in ('master', 'admin', 'gerente')
        or public.is_admin()
        or public.is_manager_or_above()
    ) then
        raise exception 'Você não possui permissão para gerenciar produtos.';
    end if;

    -- 2. Validar que o produto pertence à mesma empresa
    select
        id,
        empresa_id,
        ativo
    into
        v_target_id,
        v_target_empresa_id,
        v_target_ativo
    from public.produtos
    where id = p_produto_id;

    if v_target_id is null or v_target_empresa_id <> v_caller_empresa_id then
        raise exception 'Produto não encontrado ou pertencente a outra empresa.';
    end if;

    if v_target_ativo = p_ativo then
        return jsonb_build_object(
            'sucesso', true,
            'produto_id', v_target_id,
            'ativo', v_target_ativo
        );
    end if;

    -- Se p_ativo = true: validar assinatura e limite_produtos
    if p_ativo = true then
        v_status_ass := public.get_status_assinatura();
        if (v_status_ass->>'acesso_permitido')::boolean is distinct from true then
            raise exception '%', coalesce(v_status_ass->>'motivo_bloqueio', 'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.');
        end if;

        select a.id, p.limite_produtos
        into v_assinatura_id, v_limite_produtos
        from public.assinaturas a
        join public.planos p on p.id = a.plano_id
        where a.empresa_id = v_caller_empresa_id
          and a.status in ('trial', 'ativa')
        for update;

        if v_limite_produtos is not null then
            select count(*)
            into v_produtos_ativos_count
            from public.produtos
            where empresa_id = v_caller_empresa_id
              and ativo = true;

            if v_produtos_ativos_count >= v_limite_produtos then
                raise exception 'Limite do plano atingido. Seu plano permite até % produtos ativos. Faça upgrade do plano para reativar este registro.', v_limite_produtos;
            end if;
        end if;
    end if;

    -- Executar UPDATE
    update public.produtos
    set
        ativo = p_ativo,
        updated_at = now()
    where id = p_produto_id;

    return jsonb_build_object(
        'sucesso', true,
        'produto_id', v_target_id,
        'ativo', p_ativo
    );
end;
$$;
