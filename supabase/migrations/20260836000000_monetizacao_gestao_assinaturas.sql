-- Migration: 20260836000000_monetizacao_gestao_assinaturas.sql
-- Build 2: Monetização e Gestão de Assinaturas
-- 1. Atualizar public.get_status_assinatura() com política de inadimplência refinada
-- 2. Nova RPC public.alterar_plano(p_novo_plano_slug text)
-- 3. Nova RPC public.cancelar_assinatura()
-- 4. Nova RPC public.reativar_assinatura()

-- ==============================================================================
-- 1. ATUALIZAR get_status_assinatura()
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
        a.proxima_cobranca,
        a.updated_at,
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

    -- 4. Avaliar acesso_permitido e motivo_bloqueio conforme regras de monetização:
    -- - ativa: acesso_permitido = true
    -- - trial e fim_periodo_teste >= CURRENT_DATE: acesso_permitido = true
    -- - trial e fim_periodo_teste < CURRENT_DATE: acesso_permitido = false, motivo "Seu período de teste terminou."
    -- - pendente: acesso_permitido = true (tolerância)
    -- - atrasada: verificar updated_at. Se updated_at < CURRENT_DATE - interval '5 days' -> acesso_permitido = false,
    --   motivo "Sua fatura está em atraso há mais de 5 dias. Regularize para liberar o acesso." Caso contrário -> true
    -- - cancelada: acesso_permitido = false, motivo "Sua assinatura foi cancelada."
    -- - bloqueada: acesso_permitido = false, motivo "Sua assinatura foi bloqueada."

    if v_assinatura.status = 'ativa' then
        v_acesso_permitido := true;
        v_motivo_bloqueio := null;
    elsif v_assinatura.status = 'trial' then
        if v_assinatura.fim_periodo_teste is not null and v_assinatura.fim_periodo_teste < CURRENT_DATE then
            v_acesso_permitido := false;
            v_motivo_bloqueio := 'Seu período de teste terminou.';
        else
            v_acesso_permitido := true;
            v_motivo_bloqueio := null;
        end if;
    elsif v_assinatura.status = 'pendente' then
        v_acesso_permitido := true;
        v_motivo_bloqueio := null;
    elsif v_assinatura.status = 'atrasada' then
        if v_assinatura.updated_at < (CURRENT_DATE - interval '5 days') then
            v_acesso_permitido := false;
            v_motivo_bloqueio := 'Sua fatura está em atraso há mais de 5 dias. Regularize para liberar o acesso.';
        else
            v_acesso_permitido := true;
            v_motivo_bloqueio := null;
        end if;
    elsif v_assinatura.status = 'cancelada' then
        v_acesso_permitido := false;
        v_motivo_bloqueio := 'Sua assinatura foi cancelada.';
    elsif v_assinatura.status = 'bloqueada' then
        v_acesso_permitido := false;
        v_motivo_bloqueio := 'Sua assinatura foi bloqueada.';
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
-- 2. RPC: alterar_plano(p_novo_plano_slug text)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.alterar_plano(
    p_novo_plano_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_novo_plano record;
    v_assinatura record;
    v_usuarios_ativos integer := 0;
    v_vendedores_ativos integer := 0;
    v_produtos_ativos integer := 0;
    v_clientes_ativos integer := 0;
    v_vendas_mes integer := 0;
    v_inicio_mes timestamptz;
    v_novo_status text;
begin
    -- 1. Validar permissão (Master ou Admin)
    if not (public.is_master() or public.is_admin()) then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou masters podem alterar o plano da empresa.'
        );
    end if;

    -- 2. Resolver empresa_id
    v_empresa_id := public.get_my_empresa_id();
    if v_empresa_id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Empresa não encontrada para o usuário autenticado.'
        );
    end if;

    -- 3. Buscar plano alvo por slug
    select id, nome, slug, valor_mensal, limite_usuarios, limite_vendedores, limite_produtos, limite_clientes, limite_vendas_mes, ativo
    into v_novo_plano
    from public.planos
    where slug = trim(p_novo_plano_slug)
      and ativo = true
    limit 1;

    if v_novo_plano.id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Plano selecionado inválido ou inativo.'
        );
    end if;

    -- 4. Buscar assinatura atual com lock
    select id, empresa_id, plano_id, valor, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = v_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Assinatura não encontrada para esta empresa.'
        );
    end if;

    if v_assinatura.plano_id = v_novo_plano.id then
        return jsonb_build_object(
            'success', false,
            'error', 'A empresa já está no plano ' || v_novo_plano.nome || '.'
        );
    end if;

    -- 5. Validação de Downgrade / Limites
    -- Coletar uso atual
    select count(*) into v_usuarios_ativos
    from public.usuarios
    where empresa_id = v_empresa_id and ativo = true;

    select count(*) into v_vendedores_ativos
    from public.vendedores
    where empresa_id = v_empresa_id and ativo = true;

    select count(*) into v_produtos_ativos
    from public.produtos
    where empresa_id = v_empresa_id and ativo = true;

    select count(*) into v_clientes_ativos
    from public.clientes
    where empresa_id = v_empresa_id and ativo = true;

    v_inicio_mes := date_trunc('month', now());
    select count(*) into v_vendas_mes
    from public.vendas
    where empresa_id = v_empresa_id
      and status = 'finalizada'
      and created_at >= v_inicio_mes;

    -- Comparar uso atual com os limites do novo plano
    if v_novo_plano.limite_usuarios is not null and v_usuarios_ativos > v_novo_plano.limite_usuarios then
        return jsonb_build_object(
            'success', false,
            'error', 'Não é possível fazer downgrade: Usuários ativos atuais (' || v_usuarios_ativos || ') excede o limite do plano ' || v_novo_plano.nome || ' (' || v_novo_plano.limite_usuarios || ').'
        );
    end if;

    if v_novo_plano.limite_vendedores is not null and v_vendedores_ativos > v_novo_plano.limite_vendedores then
        return jsonb_build_object(
            'success', false,
            'error', 'Não é possível fazer downgrade: Vendedores ativos atuais (' || v_vendedores_ativos || ') excede o limite do plano ' || v_novo_plano.nome || ' (' || v_novo_plano.limite_vendedores || ').'
        );
    end if;

    if v_novo_plano.limite_produtos is not null and v_produtos_ativos > v_novo_plano.limite_produtos then
        return jsonb_build_object(
            'success', false,
            'error', 'Não é possível fazer downgrade: Produtos ativos atuais (' || v_produtos_ativos || ') excede o limite do plano ' || v_novo_plano.nome || ' (' || v_novo_plano.limite_produtos || ').'
        );
    end if;

    if v_novo_plano.limite_clientes is not null and v_clientes_ativos > v_novo_plano.limite_clientes then
        return jsonb_build_object(
            'success', false,
            'error', 'Não é possível fazer downgrade: Clientes ativos atuais (' || v_clientes_ativos || ') excede o limite do plano ' || v_novo_plano.nome || ' (' || v_novo_plano.limite_clientes || ').'
        );
    end if;

    if v_novo_plano.limite_vendas_mes is not null and v_vendas_mes > v_novo_plano.limite_vendas_mes then
        return jsonb_build_object(
            'success', false,
            'error', 'Não é possível fazer downgrade: Vendas do mês atuais (' || v_vendas_mes || ') excede o limite do plano ' || v_novo_plano.nome || ' (' || v_novo_plano.limite_vendas_mes || ').'
        );
    end if;

    -- 6. Atualizar a assinatura
    -- Se estava em trial, converter para 'ativa'
    v_novo_status := v_assinatura.status;
    if v_assinatura.status = 'trial' then
        v_novo_status := 'ativa';
    end if;

    update public.assinaturas
    set 
        plano_id = v_novo_plano.id,
        valor = v_novo_plano.valor_mensal,
        status = v_novo_status,
        updated_at = now()
    where id = v_assinatura.id;

    return jsonb_build_object(
        'success', true,
        'message', 'Plano alterado para ' || v_novo_plano.nome || ' com sucesso.',
        'novo_plano', v_novo_plano.nome
    );
end;
$$;


-- ==============================================================================
-- 3. RPC: cancelar_assinatura()
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cancelar_assinatura()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_assinatura record;
begin
    -- 1. Validar permissão (Master ou Admin)
    if not (public.is_master() or public.is_admin()) then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou masters podem cancelar a assinatura.'
        );
    end if;

    -- 2. Resolver empresa_id
    v_empresa_id := public.get_my_empresa_id();
    if v_empresa_id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Empresa não encontrada para o usuário autenticado.'
        );
    end if;

    -- 3. Buscar assinatura
    select id, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = v_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Assinatura não encontrada para esta empresa.'
        );
    end if;

    if v_assinatura.status = 'cancelada' then
        return jsonb_build_object(
            'success', false,
            'error', 'A assinatura já está cancelada.'
        );
    end if;

    -- 4. Atualizar para cancelada
    update public.assinaturas
    set 
        status = 'cancelada',
        cancelada_em = now(),
        updated_at = now()
    where id = v_assinatura.id;

    return jsonb_build_object(
        'success', true,
        'message', 'Assinatura cancelada.'
    );
end;
$$;


-- ==============================================================================
-- 4. RPC: reativar_assinatura()
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reativar_assinatura()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_assinatura record;
begin
    -- 1. Validar permissão (Master ou Admin)
    if not (public.is_master() or public.is_admin()) then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou masters podem reativar a assinatura.'
        );
    end if;

    -- 2. Resolver empresa_id
    v_empresa_id := public.get_my_empresa_id();
    if v_empresa_id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Empresa não encontrada para o usuário autenticado.'
        );
    end if;

    -- 3. Buscar assinatura
    select id, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = v_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Assinatura não encontrada para esta empresa.'
        );
    end if;

    if v_assinatura.status not in ('cancelada', 'bloqueada') then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas assinaturas canceladas ou bloqueadas podem ser reativadas.'
        );
    end if;

    -- 4. Atualizar para ativa com novos prazos
    update public.assinaturas
    set 
        status = 'ativa',
        cancelada_em = null,
        inicio = CURRENT_DATE,
        vencimento = (CURRENT_DATE + interval '30 days')::date,
        proxima_cobranca = (CURRENT_DATE + interval '30 days')::date,
        updated_at = now()
    where id = v_assinatura.id;

    return jsonb_build_object(
        'success', true,
        'message', 'Assinatura reativada.'
    );
end;
$$;
