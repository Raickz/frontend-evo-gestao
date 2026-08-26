-- Migration: 20260832000000_hardening_reativacao.sql
-- Hardening dos limites de plano na reativação de registros:
-- Criação de 4 RPCs seguras (SECURITY DEFINER, FOR UPDATE em assinaturas):
-- 1. alterar_status_usuario(p_usuario_id uuid, p_ativo boolean)
-- 2. alterar_status_vendedor(p_vendedor_id uuid, p_ativo boolean)
-- 3. alterar_status_cliente(p_cliente_id uuid, p_ativo boolean)
-- 4. alterar_status_produto(p_produto_id uuid, p_ativo boolean)

-- ==============================================================================
-- 1. RPC: alterar_status_usuario
-- ==============================================================================
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

    -- Se p_ativo = true (reativação): serializar validação e checar limite_usuarios
    if p_ativo = true then
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


-- ==============================================================================
-- 2. RPC: alterar_status_vendedor
-- ==============================================================================
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

    -- Se status já é o solicitado
    if v_target_ativo = p_ativo then
        return jsonb_build_object(
            'sucesso', true,
            'vendedor_id', v_target_id,
            'ativo', v_target_ativo
        );
    end if;

    -- Se p_ativo = true: FOR UPDATE na assinatura e validar limite_vendedores
    if p_ativo = true then
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


-- ==============================================================================
-- 3. RPC: alterar_status_cliente
-- ==============================================================================
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

    -- Se status já é o solicitado
    if v_target_ativo = p_ativo then
        return jsonb_build_object(
            'sucesso', true,
            'cliente_id', v_target_id,
            'ativo', v_target_ativo
        );
    end if;

    -- Se p_ativo = true: FOR UPDATE na assinatura e validar limite_clientes
    if p_ativo = true then
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


-- ==============================================================================
-- 4. RPC: alterar_status_produto
-- ==============================================================================
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

    -- Se status já é o solicitado
    if v_target_ativo = p_ativo then
        return jsonb_build_object(
            'sucesso', true,
            'produto_id', v_target_id,
            'ativo', v_target_ativo
        );
    end if;

    -- Se p_ativo = true: FOR UPDATE na assinatura e validar limite_produtos
    if p_ativo = true then
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
