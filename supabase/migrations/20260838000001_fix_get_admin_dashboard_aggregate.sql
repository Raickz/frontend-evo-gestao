-- Migration: 20260838000001_fix_get_admin_dashboard_aggregate.sql
-- Correção: substitui count(a.id) aninhado em jsonb_agg() por CTE

CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_total_empresas integer := 0;
    v_empresas_ativas integer := 0;
    v_empresas_trial integer := 0;
    v_trials_proximos_vencimento integer := 0;
    v_assinaturas_ativas integer := 0;
    v_assinaturas_atrasadas integer := 0;
    v_assinaturas_canceladas integer := 0;
    v_total_usuarios integer := 0;
    v_mrr numeric := 0;
    v_distribuicao jsonb := '[]'::jsonb;
    v_receita_total numeric := 0;
    v_receita_mes numeric := 0;
    v_transacoes_aprovadas integer := 0;
    v_transacoes_pendentes integer := 0;
    v_transacoes_recusadas integer := 0;
    v_ultimas_transacoes jsonb := '[]'::jsonb;
    v_inicio_mes timestamptz;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado: apenas administradores da plataforma podem acessar o painel.';
    end if;

    -- Contagem de empresas
    select count(*) into v_total_empresas from public.empresas;
    select count(*) into v_empresas_ativas from public.empresas where status = 'ativo';

    -- Contagem de assinaturas por status
    select count(*) into v_empresas_trial 
    from public.assinaturas 
    where status = 'trial' and (fim_periodo_teste is null or fim_periodo_teste >= CURRENT_DATE);

    select count(*) into v_trials_proximos_vencimento
    from public.assinaturas
    where status = 'trial' 
      and fim_periodo_teste is not null 
      and fim_periodo_teste >= CURRENT_DATE 
      and fim_periodo_teste <= (CURRENT_DATE + interval '7 days')::date;

    select count(*) into v_assinaturas_ativas from public.assinaturas where status = 'ativa';
    select count(*) into v_assinaturas_atrasadas from public.assinaturas where status = 'atrasada';
    select count(*) into v_assinaturas_canceladas from public.assinaturas where status = 'cancelada';

    -- Total de usuários ativos
    select count(*) into v_total_usuarios from public.usuarios where ativo = true;

    -- MRR: soma dos valores de assinaturas com status IN ('ativa', 'trial', 'pendente', 'atrasada')
    select coalesce(sum(valor), 0) into v_mrr
    from public.assinaturas
    where status in ('ativa', 'trial', 'pendente', 'atrasada');

    -- Distribuição por plano (CORRIGIDO: CTE separa count() do jsonb_agg())
    with contagem as (
        select
            p.id,
            p.nome,
            p.slug,
            p.ordem,
            count(a.id) as quantidade
        from public.planos p
        left join public.assinaturas a
            on a.plano_id = p.id
            and a.status in ('ativa', 'trial')
        group by p.id, p.nome, p.slug, p.ordem
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'plano_id', c.id,
                'plano_nome', c.nome,
                'slug', c.slug,
                'quantidade', c.quantidade
            )
            order by c.ordem asc
        ),
        '[]'::jsonb
    )
    into v_distribuicao
    from contagem c;

    -- Métricas Financeiras
    v_inicio_mes := date_trunc('month', now());

    select coalesce(sum(valor), 0) into v_receita_total
    from public.transacoes
    where status = 'aprovado';

    select coalesce(sum(valor), 0) into v_receita_mes
    from public.transacoes
    where status = 'aprovado'
      and created_at >= v_inicio_mes;

    select count(*) into v_transacoes_aprovadas
    from public.transacoes
    where status = 'aprovado';

    select count(*) into v_transacoes_pendentes
    from public.transacoes
    where status = 'pendente';

    select count(*) into v_transacoes_recusadas
    from public.transacoes
    where status = 'recusado'
      and created_at >= v_inicio_mes;

    -- Últimas 10 transações
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'empresa_id', t.empresa_id,
                'empresa_nome', e.nome,
                'empresa_nome_fantasia', e.nome_fantasia,
                'plano_id', t.plano_id,
                'plano_nome', p.nome,
                'plano_slug', p.slug,
                'valor', t.valor,
                'gateway', t.gateway,
                'gateway_id', t.gateway_id,
                'metodo_pagamento', t.metodo_pagamento,
                'status', t.status,
                'created_at', t.created_at
            ) order by t.created_at desc
        ),
        '[]'::jsonb
    ) into v_ultimas_transacoes
    from (
        select * from public.transacoes
        order by created_at desc
        limit 10
    ) t
    left join public.empresas e on e.id = t.empresa_id
    left join public.planos p on p.id = t.plano_id;

    return jsonb_build_object(
        'total_empresas', v_total_empresas,
        'empresas_ativas', v_empresas_ativas,
        'empresas_trial', v_empresas_trial,
        'trials_proximos_vencimento', v_trials_proximos_vencimento,
        'assinaturas_ativas', v_assinaturas_ativas,
        'assinaturas_atrasadas', v_assinaturas_atrasadas,
        'assinaturas_canceladas', v_assinaturas_canceladas,
        'distribuicao_por_plano', v_distribuicao,
        'total_usuarios', v_total_usuarios,
        'mrr', v_mrr,
        'receita_total', v_receita_total,
        'receita_mes', v_receita_mes,
        'transacoes_aprovadas', v_transacoes_aprovadas,
        'transacoes_pendentes', v_transacoes_pendentes,
        'transacoes_recusadas', v_transacoes_recusadas,
        'ultimas_transacoes', v_ultimas_transacoes
    );
end;
$$;
