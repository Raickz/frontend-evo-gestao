-- Migration: 20260838000000_pagamentos.sql
-- Build 4: Pagamentos, Checkout e Cobrança Real (MercadoPago)

-- 1. Tabela public.transacoes
CREATE TABLE IF NOT EXISTS public.transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  assinatura_id uuid REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  valor numeric NOT NULL,
  gateway text NOT NULL DEFAULT 'mercadopago',
  gateway_id text,              -- ID do pagamento no MP
  gateway_status text,           -- status retornado pelo gateway
  metodo_pagamento text,         -- 'pix', 'credit_card', 'boleto', etc.
  status text NOT NULL DEFAULT 'pendente',  -- 'pendente', 'aprovado', 'recusado', 'reembolsado', 'cancelado'
  external_reference text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices em transacoes
CREATE INDEX IF NOT EXISTS idx_transacoes_empresa_id ON public.transacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_gateway_id ON public.transacoes(gateway_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_status ON public.transacoes(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_created_at ON public.transacoes(created_at DESC);

-- Habilitar RLS em transacoes
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS em transacoes
DROP POLICY IF EXISTS "transacoes_select_empresa" ON public.transacoes;
CREATE POLICY "transacoes_select_empresa" ON public.transacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id() 
    OR public.is_platform_admin()
  );

-- INSERT/UPDATE/DELETE restritos a service_role (nenhum INSERT direto de authenticated sem service_role)
DROP POLICY IF EXISTS "transacoes_insert_service_role" ON public.transacoes;
-- Note: service_role bypasses RLS by default. If we don't grant INSERT to authenticated, authenticated users cannot insert directly, guaranteeing all transaction records are created via edge functions or platform_admin RPCs.

-- 2. Alterar tabela public.assinaturas
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'mercadopago';
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS gateway_subscription_id text;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS ultimo_pagamento_id uuid REFERENCES public.transacoes(id) ON DELETE SET NULL;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS metodo_pagamento text;

-- 3. Atualizar public.get_status_assinatura() para incluir metodo_pagamento e gateway
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
            'motivo_bloqueio', 'Empresa sem assinatura ativa.',
            'metodo_pagamento', null,
            'gateway', null
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
        a.metodo_pagamento,
        a.gateway,
        a.ultimo_pagamento_id,
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
            'motivo_bloqueio', 'Empresa sem assinatura ativa.',
            'metodo_pagamento', null,
            'gateway', null
        );
    end if;

    -- 3. Calcular dias_restantes para trial
    if v_assinatura.fim_periodo_teste is not null then
        v_dias_restantes := (v_assinatura.fim_periodo_teste - CURRENT_DATE);
    else
        v_dias_restantes := 0;
    end if;

    -- 4. Avaliar acesso_permitido e motivo_bloqueio conforme regras de monetização:
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
        'motivo_bloqueio', v_motivo_bloqueio,
        'metodo_pagamento', v_assinatura.metodo_pagamento,
        'gateway', v_assinatura.gateway
    );
end;
$$;

-- 4. RPC: criar_checkout(p_plano_slug text)
CREATE OR REPLACE FUNCTION public.criar_checkout(
    p_plano_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_plano record;
    v_assinatura record;
    v_empresa record;
begin
    -- 1. Validar permissão (Master ou Admin)
    if not (public.is_master() or public.is_admin()) then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou masters podem iniciar o checkout de assinatura.'
        );
    end if;

    -- 2. Resolver empresa_id e usuario_id
    select id, empresa_id
    into v_usuario_id, v_empresa_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and ativo = true
    limit 1;

    if v_empresa_id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Empresa não encontrada para o usuário autenticado.'
        );
    end if;

    select id, nome, nome_fantasia, cnpj, email, telefone
    into v_empresa
    from public.empresas
    where id = v_empresa_id;

    -- 3. Buscar plano pelo slug
    select id, nome, slug, valor_mensal, ativo, descricao
    into v_plano
    from public.planos
    where slug = trim(p_plano_slug)
      and ativo = true
    limit 1;

    if v_plano.id is null then
        return jsonb_build_object(
            'success', false,
            'error', 'Plano selecionado não foi encontrado ou está inativo.'
        );
    end if;

    -- 4. Buscar assinatura da empresa
    select id, plano_id, valor, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = v_empresa_id
    limit 1;

    -- Se já tiver assinatura ativa com o mesmo plano, avisar (mas permitir se for renovação/reativação/mudança)
    -- Se for trial, pendente, atrasada ou cancelada, checkout é totalmente permitido

    return jsonb_build_object(
        'success', true,
        'empresa_id', v_empresa_id,
        'empresa_nome', v_empresa.nome,
        'empresa_email', v_empresa.email,
        'plano_id', v_plano.id,
        'plano_nome', v_plano.nome,
        'plano_slug', v_plano.slug,
        'valor_mensal', v_plano.valor_mensal,
        'status_atual', coalesce(v_assinatura.status, 'sem_assinatura')
    );
end;
$$;

-- 5. RPC: get_admin_dashboard() atualizado com métricas financeiras reais
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

    -- Novas métricas financeiras Build 4
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

    -- Distribuição por plano
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'plano_id', p.id,
                'plano_nome', p.nome,
                'slug', p.slug,
                'quantidade', count(a.id)
            )
        ),
        '[]'::jsonb
    ) into v_distribuicao
    from public.planos p
    left join public.assinaturas a on a.plano_id = p.id and a.status in ('ativa', 'trial')
    group by p.id, p.nome, p.slug, p.ordem
    order by p.ordem asc;

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
        -- Campos novos de receita e transações
        'receita_total', v_receita_total,
        'receita_mes', v_receita_mes,
        'transacoes_aprovadas', v_transacoes_aprovadas,
        'transacoes_pendentes', v_transacoes_pendentes,
        'transacoes_recusadas', v_transacoes_recusadas,
        'ultimas_transacoes', v_ultimas_transacoes
    );
end;
$$;

-- 6. RPC: get_historico_financeiro_admin()
CREATE OR REPLACE FUNCTION public.get_historico_financeiro_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_total_recebido numeric := 0;
    v_total_pendente numeric := 0;
    v_total_recusado numeric := 0;
    v_transacoes jsonb := '[]'::jsonb;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado: apenas administradores da plataforma podem acessar o histórico financeiro.';
    end if;

    select coalesce(sum(valor), 0) into v_total_recebido
    from public.transacoes
    where status = 'aprovado';

    select coalesce(sum(valor), 0) into v_total_pendente
    from public.transacoes
    where status = 'pendente';

    select coalesce(sum(valor), 0) into v_total_recusado
    from public.transacoes
    where status = 'recusado';

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'empresa_id', t.empresa_id,
                'empresa_nome', e.nome,
                'empresa_nome_fantasia', e.nome_fantasia,
                'assinatura_id', t.assinatura_id,
                'plano_id', t.plano_id,
                'plano_nome', p.nome,
                'plano_slug', p.slug,
                'valor', t.valor,
                'gateway', t.gateway,
                'gateway_id', t.gateway_id,
                'gateway_status', t.gateway_status,
                'metodo_pagamento', t.metodo_pagamento,
                'status', t.status,
                'external_reference', t.external_reference,
                'metadata', t.metadata,
                'created_at', t.created_at,
                'updated_at', t.updated_at
            ) order by t.created_at desc
        ),
        '[]'::jsonb
    ) into v_transacoes
    from (
        select * from public.transacoes
        order by created_at desc
        limit 100
    ) t
    left join public.empresas e on e.id = t.empresa_id
    left join public.planos p on p.id = t.plano_id;

    return jsonb_build_object(
        'total_recebido', v_total_recebido,
        'total_pendente', v_total_pendente,
        'total_recusado', v_total_recusado,
        'transacoes', v_transacoes
    );
end;
$$;
