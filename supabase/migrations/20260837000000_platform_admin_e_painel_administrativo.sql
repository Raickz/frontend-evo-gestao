-- Migration: 20260837000000_platform_admin_e_painel_administrativo.sql
-- Build 3: Painel Administrativo da Plataforma (Platform Admin)

-- 1. Atualizar CHECK constraint em public.usuarios.perfil para aceitar 'platform_admin'
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_check 
  CHECK (perfil = ANY (ARRAY['master'::text, 'admin'::text, 'gerente'::text, 'vendedor'::text, 'operador'::text, 'platform_admin'::text]));

-- 2. Função is_platform_admin()
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND perfil = 'platform_admin'
      AND ativo = true
  );
$$;

-- 3. Tabela public.log_assinaturas
CREATE TABLE IF NOT EXISTS public.log_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_anterior_id uuid REFERENCES public.planos(id),
  plano_novo_id uuid REFERENCES public.planos(id),
  valor_anterior numeric,
  valor_novo numeric,
  tipo text NOT NULL, -- 'criacao', 'trial_inicio', 'upgrade', 'downgrade', 'cancelamento', 'reativacao', 'bloqueio', 'desbloqueio'
  usuario_responsavel_id uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS em log_assinaturas
ALTER TABLE public.log_assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_select_log_assinaturas" ON public.log_assinaturas;
CREATE POLICY "platform_admin_select_log_assinaturas" ON public.log_assinaturas
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- 4. Atualizar RLS de tabelas gerais para que platform_admin possa visualizar quando necessário
DROP POLICY IF EXISTS "platform_admin_select_empresas" ON public.empresas;
CREATE POLICY "platform_admin_select_empresas" ON public.empresas
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_select_usuarios" ON public.usuarios;
CREATE POLICY "platform_admin_select_usuarios" ON public.usuarios
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_select_assinaturas" ON public.assinaturas;
CREATE POLICY "platform_admin_select_assinaturas" ON public.assinaturas
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Permitir platform_admin ler e gerenciar planos (inclusive inativos)
DROP POLICY IF EXISTS "planos_select_public" ON public.planos;
CREATE POLICY "planos_select_public" ON public.planos
  FOR SELECT TO anon, authenticated
  USING (ativo = true OR public.is_platform_admin());

-- 5. Atualizar RPCs existentes para registrar no log_assinaturas
-- 5.1 alterar_plano
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
    v_usuario_id uuid;
    v_novo_plano record;
    v_assinatura record;
    v_usuarios_ativos integer := 0;
    v_vendedores_ativos integer := 0;
    v_produtos_ativos integer := 0;
    v_clientes_ativos integer := 0;
    v_vendas_mes integer := 0;
    v_inicio_mes timestamptz;
    v_novo_status text;
    v_tipo_log text;
begin
    -- 1. Validar permissão (Master ou Admin)
    if not (public.is_master() or public.is_admin()) then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou masters podem alterar o plano da empresa.'
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
    v_novo_status := v_assinatura.status;
    if v_assinatura.status = 'trial' then
        v_novo_status := 'ativa';
    end if;

    -- Determinar tipo de log (upgrade vs downgrade)
    if v_novo_plano.valor_mensal >= coalesce(v_assinatura.valor, 0) then
        v_tipo_log := 'upgrade';
    else
        v_tipo_log := 'downgrade';
    end if;

    update public.assinaturas
    set 
        plano_id = v_novo_plano.id,
        valor = v_novo_plano.valor_mensal,
        status = v_novo_status,
        updated_at = now()
    where id = v_assinatura.id;

    -- Inserir no log_assinaturas
    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        usuario_responsavel_id
    ) values (
        v_empresa_id,
        v_assinatura.plano_id,
        v_novo_plano.id,
        v_assinatura.valor,
        v_novo_plano.valor_mensal,
        v_tipo_log,
        v_usuario_id
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Plano alterado para ' || v_novo_plano.nome || ' com sucesso.',
        'novo_plano', v_novo_plano.nome
    );
end;
$$;

-- 5.2 cancelar_assinatura
CREATE OR REPLACE FUNCTION public.cancelar_assinatura()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_assinatura record;
begin
    -- 1. Validar permissão (Master ou Admin)
    if not (public.is_master() or public.is_admin()) then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou masters podem cancelar a assinatura.'
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

    -- 3. Buscar assinatura
    select id, plano_id, valor, status
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

    -- Inserir no log_assinaturas
    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        usuario_responsavel_id
    ) values (
        v_empresa_id,
        v_assinatura.plano_id,
        v_assinatura.plano_id,
        v_assinatura.valor,
        v_assinatura.valor,
        'cancelamento',
        v_usuario_id
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Assinatura cancelada.'
    );
end;
$$;

-- 5.3 reativar_assinatura
CREATE OR REPLACE FUNCTION public.reativar_assinatura()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_assinatura record;
begin
    -- 1. Validar permissão (Master ou Admin)
    if not (public.is_master() or public.is_admin()) then
        return jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou masters podem reativar a assinatura.'
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

    -- 3. Buscar assinatura
    select id, plano_id, valor, status
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

    -- Inserir no log_assinaturas
    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        usuario_responsavel_id
    ) values (
        v_empresa_id,
        v_assinatura.plano_id,
        v_assinatura.plano_id,
        v_assinatura.valor,
        v_assinatura.valor,
        'reativacao',
        v_usuario_id
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Assinatura reativada.'
    );
end;
$$;


-- ==============================================================================
-- 6. RPCs EXCLUSIVAS DO PLATFORM_ADMIN
-- ==============================================================================

-- 6.1 get_admin_dashboard()
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

    -- Distribuição por plano (planos ativos/inativos que tenham assinaturas ativas ou em trial)
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
        'mrr', v_mrr
    );
end;
$$;

-- 6.2 listar_empresas_admin()
CREATE OR REPLACE FUNCTION public.listar_empresas_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_empresas jsonb;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado: apenas administradores da plataforma podem listar empresas.';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', e.id,
                'nome', e.nome,
                'nome_fantasia', e.nome_fantasia,
                'cnpj', e.cnpj,
                'email', e.email,
                'telefone', e.telefone,
                'status', e.status,
                'created_at', e.created_at,
                'plano_id', a.plano_id,
                'plano_nome', p.nome,
                'plano_slug', p.slug,
                'status_assinatura', a.status,
                'valor_assinatura', a.valor,
                'inicio', a.inicio,
                'vencimento', a.vencimento,
                'fim_periodo_teste', a.fim_periodo_teste,
                'total_usuarios', coalesce(u.total_usuarios, 0)
            ) order by e.created_at desc
        ),
        '[]'::jsonb
    ) into v_empresas
    from public.empresas e
    left join public.assinaturas a on a.empresa_id = e.id
    left join public.planos p on p.id = a.plano_id
    left join (
        select empresa_id, count(*) as total_usuarios
        from public.usuarios
        where ativo = true
        group by empresa_id
    ) u on u.empresa_id = e.id;

    return v_empresas;
end;
$$;

-- 6.3 bloquear_empresa(p_empresa_id uuid)
CREATE OR REPLACE FUNCTION public.bloquear_empresa(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_usuario_id uuid;
    v_assinatura record;
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    select id into v_usuario_id
    from public.usuarios
    where auth_user_id = auth.uid()
    limit 1;

    select id, plano_id, valor, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = p_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object('success', false, 'error', 'Assinatura não encontrada para esta empresa.');
    end if;

    update public.assinaturas
    set 
        status = 'bloqueada',
        updated_at = now()
    where id = v_assinatura.id;

    -- Inserir log
    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        usuario_responsavel_id
    ) values (
        p_empresa_id,
        v_assinatura.plano_id,
        v_assinatura.plano_id,
        v_assinatura.valor,
        v_assinatura.valor,
        'bloqueio',
        v_usuario_id
    );

    return jsonb_build_object('success', true, 'message', 'Empresa bloqueada com sucesso.');
end;
$$;

-- 6.4 desbloquear_empresa(p_empresa_id uuid)
CREATE OR REPLACE FUNCTION public.desbloquear_empresa(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_usuario_id uuid;
    v_assinatura record;
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    select id into v_usuario_id
    from public.usuarios
    where auth_user_id = auth.uid()
    limit 1;

    select id, plano_id, valor, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = p_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object('success', false, 'error', 'Assinatura não encontrada para esta empresa.');
    end if;

    update public.assinaturas
    set 
        status = 'ativa',
        cancelada_em = null,
        vencimento = (CURRENT_DATE + interval '30 days')::date,
        proxima_cobranca = (CURRENT_DATE + interval '30 days')::date,
        updated_at = now()
    where id = v_assinatura.id;

    -- Inserir log
    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        usuario_responsavel_id
    ) values (
        p_empresa_id,
        v_assinatura.plano_id,
        v_assinatura.plano_id,
        v_assinatura.valor,
        v_assinatura.valor,
        'desbloqueio',
        v_usuario_id
    );

    return jsonb_build_object('success', true, 'message', 'Empresa desbloqueada com sucesso.');
end;
$$;

-- 6.5 alterar_plano_admin(p_empresa_id uuid, p_novo_plano_slug text)
CREATE OR REPLACE FUNCTION public.alterar_plano_admin(
    p_empresa_id uuid,
    p_novo_plano_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_usuario_id uuid;
    v_novo_plano record;
    v_assinatura record;
    v_tipo_log text;
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    select id into v_usuario_id
    from public.usuarios
    where auth_user_id = auth.uid()
    limit 1;

    select id, nome, slug, valor_mensal
    into v_novo_plano
    from public.planos
    where slug = trim(p_novo_plano_slug)
    limit 1;

    if v_novo_plano.id is null then
        return jsonb_build_object('success', false, 'error', 'Plano especificado não foi encontrado.');
    end if;

    select id, plano_id, valor, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = p_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object('success', false, 'error', 'Assinatura não encontrada para esta empresa.');
    end if;

    if v_novo_plano.valor_mensal >= coalesce(v_assinatura.valor, 0) then
        v_tipo_log := 'upgrade';
    else
        v_tipo_log := 'downgrade';
    end if;

    update public.assinaturas
    set 
        plano_id = v_novo_plano.id,
        valor = v_novo_plano.valor_mensal,
        updated_at = now()
    where id = v_assinatura.id;

    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        usuario_responsavel_id
    ) values (
        p_empresa_id,
        v_assinatura.plano_id,
        v_novo_plano.id,
        v_assinatura.valor,
        v_novo_plano.valor_mensal,
        v_tipo_log,
        v_usuario_id
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Plano alterado para ' || v_novo_plano.nome || ' com sucesso.',
        'novo_plano', v_novo_plano.nome
    );
end;
$$;

-- 6.6 listar_planos_admin()
CREATE OR REPLACE FUNCTION public.listar_planos_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_planos jsonb;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado.';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'nome', p.nome,
                'slug', p.slug,
                'descricao', p.descricao,
                'valor_mensal', p.valor_mensal,
                'periodo_teste_dias', p.periodo_teste_dias,
                'limite_usuarios', p.limite_usuarios,
                'limite_vendedores', p.limite_vendedores,
                'limite_produtos', p.limite_produtos,
                'limite_clientes', p.limite_clientes,
                'limite_vendas_mes', p.limite_vendas_mes,
                'recursos', p.recursos,
                'ordem', p.ordem,
                'ativo', p.ativo,
                'created_at', p.created_at,
                'updated_at', p.updated_at
            ) order by p.ordem asc, p.created_at asc
        ),
        '[]'::jsonb
    ) into v_planos
    from public.planos p;

    return v_planos;
end;
$$;

-- 6.7 criar_plano_admin
CREATE OR REPLACE FUNCTION public.criar_plano_admin(
    p_nome text,
    p_slug text,
    p_descricao text,
    p_valor_mensal numeric,
    p_periodo_teste_dias integer,
    p_limite_usuarios integer,
    p_limite_vendedores integer,
    p_limite_produtos integer,
    p_limite_clientes integer,
    p_limite_vendas_mes integer,
    p_recursos jsonb,
    p_ordem integer,
    p_ativo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_novo_id uuid;
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    if trim(p_nome) = '' or trim(p_slug) = '' then
        return jsonb_build_object('success', false, 'error', 'Nome e slug são obrigatórios.');
    end if;

    insert into public.planos (
        nome,
        slug,
        descricao,
        valor_mensal,
        periodo_teste_dias,
        limite_usuarios,
        limite_vendedores,
        limite_produtos,
        limite_clientes,
        limite_vendas_mes,
        recursos,
        ordem,
        ativo,
        created_at,
        updated_at
    ) values (
        trim(p_nome),
        trim(p_slug),
        p_descricao,
        coalesce(p_valor_mensal, 0),
        coalesce(p_periodo_teste_dias, 0),
        p_limite_usuarios,
        p_limite_vendedores,
        p_limite_produtos,
        p_limite_clientes,
        p_limite_vendas_mes,
        coalesce(p_recursos, '[]'::jsonb),
        coalesce(p_ordem, 0),
        coalesce(p_ativo, true),
        now(),
        now()
    )
    returning id into v_novo_id;

    return jsonb_build_object('success', true, 'id', v_novo_id, 'message', 'Plano criado com sucesso.');
end;
$$;

-- 6.8 editar_plano_admin
CREATE OR REPLACE FUNCTION public.editar_plano_admin(
    p_plano_id uuid,
    p_nome text,
    p_slug text,
    p_descricao text,
    p_valor_mensal numeric,
    p_periodo_teste_dias integer,
    p_limite_usuarios integer,
    p_limite_vendedores integer,
    p_limite_produtos integer,
    p_limite_clientes integer,
    p_limite_vendas_mes integer,
    p_recursos jsonb,
    p_ordem integer,
    p_ativo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    if trim(p_nome) = '' or trim(p_slug) = '' then
        return jsonb_build_object('success', false, 'error', 'Nome e slug são obrigatórios.');
    end if;

    update public.planos
    set
        nome = trim(p_nome),
        slug = trim(p_slug),
        descricao = p_descricao,
        valor_mensal = coalesce(p_valor_mensal, 0),
        periodo_teste_dias = coalesce(p_periodo_teste_dias, 0),
        limite_usuarios = p_limite_usuarios,
        limite_vendedores = p_limite_vendedores,
        limite_produtos = p_limite_produtos,
        limite_clientes = p_limite_clientes,
        limite_vendas_mes = p_limite_vendas_mes,
        recursos = coalesce(p_recursos, '[]'::jsonb),
        ordem = coalesce(p_ordem, 0),
        ativo = coalesce(p_ativo, true),
        updated_at = now()
    where id = p_plano_id;

    return jsonb_build_object('success', true, 'message', 'Plano atualizado com sucesso.');
end;
$$;

-- 6.9 toggle_plano_ativo
CREATE OR REPLACE FUNCTION public.toggle_plano_ativo(
    p_plano_id uuid,
    p_ativo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    update public.planos
    set
        ativo = p_ativo,
        updated_at = now()
    where id = p_plano_id;

    return jsonb_build_object('success', true, 'message', 'Status do plano alterado com sucesso.');
end;
$$;

-- 6.10 listar_historico_admin()
CREATE OR REPLACE FUNCTION public.listar_historico_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_logs jsonb;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado.';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', l.id,
                'empresa_id', l.empresa_id,
                'empresa_nome', e.nome,
                'empresa_nome_fantasia', e.nome_fantasia,
                'plano_anterior_id', l.plano_anterior_id,
                'plano_anterior_nome', pa.nome,
                'plano_novo_id', l.plano_novo_id,
                'plano_novo_nome', pn.nome,
                'valor_anterior', l.valor_anterior,
                'valor_novo', l.valor_novo,
                'tipo', l.tipo,
                'usuario_responsavel_id', l.usuario_responsavel_id,
                'usuario_responsavel_nome', u.nome,
                'created_at', l.created_at
            ) order by l.created_at desc
        ),
        '[]'::jsonb
    ) into v_logs
    from public.log_assinaturas l
    left join public.empresas e on e.id = l.empresa_id
    left join public.planos pa on pa.id = l.plano_anterior_id
    left join public.planos pn on pn.id = l.plano_novo_id
    left join public.usuarios u on u.id = l.usuario_responsavel_id;

    return v_logs;
end;
$$;

-- 7. Seed user inicial (raicksilva10@gmail.com) como platform_admin caso não exista
DO $$
DECLARE
  v_auth_id uuid;
  v_user_id uuid;
BEGIN
  -- Se o usuário raicksilva10@gmail.com já existe no auth.users
  SELECT id INTO v_auth_id FROM auth.users WHERE email = 'raicksilva10@gmail.com' LIMIT 1;
  
  IF v_auth_id IS NULL THEN
    v_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000',
      'raicksilva10@gmail.com',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Admin Plataforma EVO"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );
  END IF;

  -- Inserir ou atualizar em public.usuarios com perfil = 'platform_admin' e empresa_id = NULL
  SELECT id INTO v_user_id FROM public.usuarios WHERE auth_user_id = v_auth_id;
  
  IF v_user_id IS NULL THEN
    INSERT INTO public.usuarios (
      auth_user_id,
      empresa_id,
      nome,
      email,
      perfil,
      ativo
    ) VALUES (
      v_auth_id,
      NULL,
      'Admin Plataforma EVO',
      'raicksilva10@gmail.com',
      'platform_admin',
      true
    );
  ELSE
    UPDATE public.usuarios
    SET perfil = 'platform_admin',
        empresa_id = NULL,
        ativo = true
    WHERE id = v_user_id;
  END IF;
END $$;
