-- Migration: 20260839000000_cadastro_manual_e_central_assinaturas.sql
-- Build: Cadastro Manual Completo de Empresa e Controle Central de Assinaturas

-- 1. Estender tabela public.empresas com campos cadastrais e dados comerciais/responsável
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS inscricao_estadual text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS inscricao_municipal text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS observacoes text;
-- Dados do Responsável Legal da Empresa
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS responsavel_nome text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS responsavel_cpf text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS responsavel_email text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS responsavel_telefone text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS responsavel_whatsapp text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS responsavel_cargo text;
-- Vendedor/Admin responsável pelo cadastro manual
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS criado_por_admin_id uuid REFERENCES public.usuarios(id);

-- 2. Estender tabela public.assinaturas com campos comerciais de contratação manual
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS valor_contratado numeric;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS periodicidade text DEFAULT 'mensal';
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS data_contratacao date;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS observacoes_comerciais text;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS motivo_suspensao text;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS observacao_suspensao text;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS motivo_cancelamento text;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS observacao_cancelamento text;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS responsavel_cancelamento_id uuid REFERENCES public.usuarios(id);

-- Atualizar CHECK constraint de status em assinaturas caso necessário para aceitar 'suspensa'
ALTER TABLE public.assinaturas DROP CONSTRAINT IF EXISTS assinaturas_status_check;
ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_status_check 
  CHECK (status = ANY (ARRAY['trial'::text, 'ativa'::text, 'pendente'::text, 'atrasada'::text, 'cancelada'::text, 'bloqueada'::text, 'suspensa'::text]));

-- Atualizar CHECK constraint de status em empresas para aceitar 'inativo' e 'suspenso'
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_status_check;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_status_check 
  CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'bloqueado'::text, 'cancelado'::text, 'suspenso'::text]));

-- 3. Estender tabela public.log_assinaturas com detalhes e valores
ALTER TABLE public.log_assinaturas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.log_assinaturas ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 4. Criar RPC transacional: criar_empresa_manual_admin
CREATE OR REPLACE FUNCTION public.criar_empresa_manual_admin(
    p_empresa jsonb,
    p_responsavel jsonb,
    p_master jsonb,
    p_plano_slug text,
    p_contratacao jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_admin_id uuid;
    v_cnpj text;
    v_razao_social text;
    v_master_email text;
    v_master_nome text;
    v_master_senha text;
    v_plano record;
    v_nova_empresa_id uuid;
    v_novo_usuario_id uuid;
    v_nova_assinatura_id uuid;
    v_status_empresa text := 'ativo';
    v_status_assinatura text := 'ativa';
    v_data_contratacao date;
    v_data_inicio date;
    v_fim_teste date;
    v_proximo_vencimento date;
    v_valor_contratado numeric;
    v_desconto numeric;
    v_valor_final numeric;
    v_periodicidade text;
    v_forma_pagamento text;
    v_obs_comerciais text;
begin
    -- 1. Validar se o usuário logado é platform_admin
    if not public.is_platform_admin() then
        return jsonb_build_object(
            'success', false,
            'error', 'Acesso negado: apenas administradores da plataforma podem criar empresas manualmente.'
        );
    end if;

    -- Obter id do platform_admin logado
    select id into v_admin_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and perfil = 'platform_admin'
      and ativo = true
    limit 1;

    -- 2. Extrair e validar dados da empresa
    v_razao_social := trim(coalesce(p_empresa->>'nome', ''));
    v_cnpj := regexp_replace(coalesce(p_empresa->>'cnpj', ''), '\D', '', 'g');

    if v_razao_social = '' then
        return jsonb_build_object('success', false, 'error', 'A Razão Social é obrigatória.');
    end if;

    if v_cnpj = '' or length(v_cnpj) <> 14 then
        return jsonb_build_object('success', false, 'error', 'CNPJ inválido. Deve conter 14 dígitos numéricos.');
    end if;

    -- Verificar duplicidade de CNPJ
    if exists (
        select 1 from public.empresas 
        where regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') = v_cnpj
    ) then
        return jsonb_build_object('success', false, 'error', 'Já existe uma empresa cadastrada com este CNPJ.');
    end if;

    -- 3. Extrair e validar dados do usuário Master
    v_master_nome := trim(coalesce(p_master->>'nome', ''));
    v_master_email := trim(lower(coalesce(p_master->>'email', '')));
    v_master_senha := coalesce(p_master->>'senha', '');

    if v_master_nome = '' then
        return jsonb_build_object('success', false, 'error', 'O nome do usuário Master é obrigatório.');
    end if;

    if v_master_email = '' or v_master_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
        return jsonb_build_object('success', false, 'error', 'E-mail do usuário Master é inválido ou obrigatório.');
    end if;

    if length(v_master_senha) < 6 then
        return jsonb_build_object('success', false, 'error', 'A senha do usuário Master deve ter pelo menos 6 caracteres.');
    end if;

    -- Verificar se o e-mail já existe em usuarios
    if exists (select 1 from public.usuarios where lower(email) = v_master_email) then
        return jsonb_build_object('success', false, 'error', 'Já existe um usuário no sistema com este e-mail de acesso (' || v_master_email || ').');
    end if;

    -- 4. Validar plano selecionado (se informado)
    if p_plano_slug is not null and trim(p_plano_slug) <> '' and trim(p_plano_slug) <> 'nenhum' then
        select id, nome, slug, valor_mensal, limite_usuarios, limite_vendedores, limite_clientes, limite_produtos
        into v_plano
        from public.planos
        where slug = trim(p_plano_slug)
        limit 1;

        if v_plano.id is null then
            return jsonb_build_object('success', false, 'error', 'Plano comercial selecionado não foi encontrado.');
        end if;
    end if;

    -- 5. Extrair e tratar datas e valores da contratação
    v_data_contratacao := coalesce((p_contratacao->>'data_contratacao')::date, CURRENT_DATE);
    v_data_inicio := coalesce((p_contratacao->>'data_inicio')::date, CURRENT_DATE);
    v_fim_teste := (p_contratacao->>'fim_periodo_teste')::date;
    v_proximo_vencimento := (p_contratacao->>'proximo_vencimento')::date;
    
    if v_proximo_vencimento is null then
        v_proximo_vencimento := (v_data_inicio + interval '30 days')::date;
    end if;

    if v_proximo_vencimento < v_data_inicio then
        return jsonb_build_object('success', false, 'error', 'A data de vencimento não pode ser anterior à data de início.');
    end if;

    v_valor_contratado := coalesce((p_contratacao->>'valor_contratado')::numeric, v_plano.valor_mensal, 0);
    v_desconto := coalesce((p_contratacao->>'desconto')::numeric, 0);
    v_valor_final := coalesce((p_contratacao->>'valor_final')::numeric, (v_valor_contratado - v_desconto));
    if v_valor_final < 0 then
        v_valor_final := 0;
    end if;

    v_periodicidade := coalesce(p_contratacao->>'periodicidade', 'mensal');
    v_forma_pagamento := coalesce(p_contratacao->>'forma_pagamento', 'pix');
    v_status_assinatura := coalesce(p_contratacao->>'status_assinatura', 'ativa');
    v_obs_comerciais := p_contratacao->>'observacoes_comerciais';
    v_status_empresa := coalesce(p_empresa->>'status', 'ativo');

    -- 6. INSERIR EMPRESA
    insert into public.empresas (
        nome,
        nome_fantasia,
        cnpj,
        inscricao_estadual,
        inscricao_municipal,
        email,
        telefone,
        whatsapp,
        cep,
        estado,
        cidade,
        bairro,
        endereco,
        numero,
        complemento,
        observacoes,
        responsavel_nome,
        responsavel_cpf,
        responsavel_email,
        responsavel_telefone,
        responsavel_whatsapp,
        responsavel_cargo,
        criado_por_admin_id,
        status,
        created_at,
        updated_at
    ) values (
        v_razao_social,
        p_empresa->>'nome_fantasia',
        p_empresa->>'cnpj',
        p_empresa->>'inscricao_estadual',
        p_empresa->>'inscricao_municipal',
        p_empresa->>'email',
        p_empresa->>'telefone',
        p_empresa->>'whatsapp',
        p_empresa->>'cep',
        p_empresa->>'estado',
        p_empresa->>'cidade',
        p_empresa->>'bairro',
        p_empresa->>'endereco',
        p_empresa->>'numero',
        p_empresa->>'complemento',
        p_empresa->>'observacoes',
        p_responsavel->>'nome',
        p_responsavel->>'cpf',
        p_responsavel->>'email',
        p_responsavel->>'telefone',
        p_responsavel->>'whatsapp',
        p_responsavel->>'cargo',
        v_admin_id,
        v_status_empresa,
        now(),
        now()
    )
    returning id into v_nova_empresa_id;

    -- 7. CRIAR ASSINATURA (se houver plano selecionado)
    if v_plano.id is not null then
        insert into public.assinaturas (
            empresa_id,
            plano_id,
            valor,
            valor_contratado,
            desconto,
            periodicidade,
            data_contratacao,
            inicio,
            vencimento,
            fim_periodo_teste,
            proxima_cobranca,
            metodo_pagamento,
            gateway,
            observacoes_comerciais,
            status,
            created_at,
            updated_at
        ) values (
            v_nova_empresa_id,
            v_plano.id,
            v_valor_final,
            v_valor_contratado,
            v_desconto,
            v_periodicidade,
            v_data_contratacao,
            v_data_inicio,
            v_proximo_vencimento,
            v_fim_teste,
            v_proximo_vencimento,
            v_forma_pagamento,
            'manual',
            v_obs_comerciais,
            v_status_assinatura,
            now(),
            now()
        )
        returning id into v_nova_assinatura_id;

        -- Registrar no log_assinaturas
        insert into public.log_assinaturas (
            empresa_id,
            plano_anterior_id,
            plano_novo_id,
            valor_anterior,
            valor_novo,
            tipo,
            descricao,
            usuario_responsavel_id,
            metadata
        ) values (
            v_nova_empresa_id,
            null,
            v_plano.id,
            null,
            v_valor_final,
            'criacao',
            'Cadastro manual de empresa realizado pelo Platform Admin no plano ' || v_plano.nome,
            v_admin_id,
            jsonb_build_object(
                'forma_pagamento', v_forma_pagamento,
                'periodicidade', v_periodicidade,
                'status_assinatura', v_status_assinatura,
                'desconto', v_desconto,
                'valor_contratado', v_valor_contratado
            )
        );
    end if;

    return jsonb_build_object(
        'success', true,
        'empresa_id', v_nova_empresa_id,
        'assinatura_id', v_nova_assinatura_id,
        'master_email', v_master_email,
        'master_nome', v_master_nome,
        'message', 'Empresa e assinatura cadastradas com sucesso. Prosseguindo com criação do usuário Master.'
    );
end;
$$;

-- 5. RPC: listar_assinaturas_admin()
CREATE OR REPLACE FUNCTION public.listar_assinaturas_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_assinaturas jsonb;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado: apenas administradores da plataforma podem acessar esta lista.';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', a.id,
                'empresa_id', e.id,
                'empresa_nome', e.nome,
                'empresa_nome_fantasia', e.nome_fantasia,
                'empresa_cnpj', e.cnpj,
                'empresa_email', e.email,
                'empresa_telefone', e.telefone,
                'empresa_status', e.status,
                'plano_id', p.id,
                'plano_nome', coalesce(p.nome, 'Nenhum'),
                'plano_slug', p.slug,
                'limite_usuarios', p.limite_usuarios,
                'limite_vendedores', p.limite_vendedores,
                'limite_clientes', p.limite_clientes,
                'limite_produtos', p.limite_produtos,
                'recursos', p.recursos,
                'status', a.status,
                'valor', a.valor,
                'valor_contratado', a.valor_contratado,
                'desconto', a.desconto,
                'periodicidade', a.periodicidade,
                'data_contratacao', a.data_contratacao,
                'inicio', a.inicio,
                'vencimento', a.vencimento,
                'fim_periodo_teste', a.fim_periodo_teste,
                'proxima_cobranca', a.proxima_cobranca,
                'cancelada_em', a.cancelada_em,
                'gateway', a.gateway,
                'metodo_pagamento', a.metodo_pagamento,
                'observacoes_comerciais', a.observacoes_comerciais,
                'motivo_suspensao', a.motivo_suspensao,
                'observacao_suspensao', a.observacao_suspensao,
                'motivo_cancelamento', a.motivo_cancelamento,
                'observacao_cancelamento', a.observacao_cancelamento,
                'created_at', a.created_at,
                'updated_at', a.updated_at,
                'ultimo_pagamento', (
                    select jsonb_build_object(
                        'id', t.id,
                        'valor', t.valor,
                        'data', t.created_at,
                        'metodo', t.metodo_pagamento,
                        'gateway', t.gateway,
                        'status', t.status
                    )
                    from public.transacoes t
                    where t.empresa_id = e.id and t.status = 'aprovado'
                    order by t.created_at desc
                    limit 1
                ),
                'total_usuarios_ativos', coalesce(u.total_usuarios, 0)
            ) order by a.created_at desc
        ),
        '[]'::jsonb
    ) into v_assinaturas
    from public.assinaturas a
    join public.empresas e on e.id = a.empresa_id
    left join public.planos p on p.id = a.plano_id
    left join (
        select empresa_id, count(*) as total_usuarios
        from public.usuarios
        where ativo = true
        group by empresa_id
    ) u on u.empresa_id = e.id;

    return v_assinaturas;
end;
$$;

-- 6. RPC: get_kpis_assinaturas_admin()
CREATE OR REPLACE FUNCTION public.get_kpis_assinaturas_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_total_assinaturas integer := 0;
    v_ativas integer := 0;
    v_em_teste integer := 0;
    v_vencendo_breve integer := 0;
    v_em_atraso integer := 0;
    v_suspensas integer := 0;
    v_canceladas integer := 0;
    v_mrr_atual numeric := 0;
    v_mrr_anterior numeric := 0;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado.';
    end if;

    select count(*) into v_total_assinaturas from public.assinaturas;
    select count(*) into v_ativas from public.assinaturas where status = 'ativa';
    select count(*) into v_em_teste from public.assinaturas where status = 'trial';
    
    -- Vencendo em breve: vencimento entre hoje e 7 dias à frente
    select count(*) into v_vencendo_breve
    from public.assinaturas
    where status in ('ativa', 'trial')
      and vencimento is not null
      and vencimento >= CURRENT_DATE
      and vencimento <= (CURRENT_DATE + interval '7 days')::date;

    -- Em atraso: status 'atrasada' ou vencimento menor que hoje e status ativa
    select count(*) into v_em_atraso
    from public.assinaturas
    where status = 'atrasada' 
       or (status = 'ativa' and vencimento is not null and vencimento < CURRENT_DATE);

    select count(*) into v_suspensas from public.assinaturas where status in ('suspensa', 'bloqueada');
    select count(*) into v_canceladas from public.assinaturas where status = 'cancelada';

    -- MRR Atual: soma dos valores mensais calculados com base na periodicidade (exclui canceladas, suspensas e bloqueadas)
    select coalesce(
        sum(
            case 
                when periodicidade = 'anual' then (coalesce(valor, 0) / 12)
                when periodicidade = 'semestral' then (coalesce(valor, 0) / 6)
                when periodicidade = 'trimestral' then (coalesce(valor, 0) / 3)
                else coalesce(valor, 0)
            end
        ), 0
    ) into v_mrr_atual
    from public.assinaturas
    where status in ('ativa', 'trial', 'pendente', 'atrasada');

    -- MRR Anterior (estimado pelo log do mês anterior ou padrão)
    select coalesce(
        sum(
            case 
                when periodicidade = 'anual' then (coalesce(valor, 0) / 12)
                when periodicidade = 'semestral' then (coalesce(valor, 0) / 6)
                when periodicidade = 'trimestral' then (coalesce(valor, 0) / 3)
                else coalesce(valor, 0)
            end
        ), 0
    ) into v_mrr_anterior
    from public.assinaturas
    where status in ('ativa', 'trial', 'pendente', 'atrasada')
      and created_at < date_trunc('month', now());

    return jsonb_build_object(
        'total_assinaturas', v_total_assinaturas,
        'ativas', v_ativas,
        'em_teste', v_em_teste,
        'vencendo_breve', v_vencendo_breve,
        'em_atraso', v_em_atraso,
        'suspensas', v_suspensas,
        'canceladas', v_canceladas,
        'mrr_atual', v_mrr_atual,
        'mrr_anterior', v_mrr_anterior
    );
end;
$$;

-- 7. RPC: registrar_pagamento_manual_admin
CREATE OR REPLACE FUNCTION public.registrar_pagamento_manual_admin(
    p_empresa_id uuid,
    p_valor numeric,
    p_data_pagamento date,
    p_forma_pagamento text,
    p_competencia text,
    p_proximo_vencimento date,
    p_referencia text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_admin_id uuid;
    v_assinatura record;
    v_transacao_id uuid;
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    if p_valor is null or p_valor <= 0 then
        return jsonb_build_object('success', false, 'error', 'O valor do pagamento deve ser maior que zero.');
    end if;

    select id into v_admin_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and perfil = 'platform_admin'
      and ativo = true
    limit 1;

    -- Buscar assinatura com lock
    select id, empresa_id, plano_id, valor, status
    into v_assinatura
    from public.assinaturas
    where empresa_id = p_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object('success', false, 'error', 'Assinatura não encontrada para esta empresa.');
    end if;

    -- 1. Inserir registro na tabela transacoes com status aprovado
    insert into public.transacoes (
        empresa_id,
        assinatura_id,
        plano_id,
        valor,
        gateway,
        metodo_pagamento,
        status,
        external_reference,
        metadata,
        created_at,
        updated_at
    ) values (
        p_empresa_id,
        v_assinatura.id,
        v_assinatura.plano_id,
        p_valor,
        'manual',
        coalesce(p_forma_pagamento, 'pix'),
        'aprovado',
        p_referencia,
        jsonb_build_object(
            'competencia', p_competencia,
            'registrado_por_admin_id', v_admin_id,
            'data_pagamento', p_data_pagamento
        ),
        coalesce(p_data_pagamento::timestamptz, now()),
        now()
    )
    returning id into v_transacao_id;

    -- 2. Atualizar a assinatura
    update public.assinaturas
    set 
        status = 'ativa',
        ultimo_pagamento_id = v_transacao_id,
        vencimento = coalesce(p_proximo_vencimento, (CURRENT_DATE + interval '30 days')::date),
        proxima_cobranca = coalesce(p_proximo_vencimento, (CURRENT_DATE + interval '30 days')::date),
        metodo_pagamento = coalesce(p_forma_pagamento, metodo_pagamento),
        updated_at = now()
    where id = v_assinatura.id;

    -- 3. Registrar no log de auditoria
    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        descricao,
        usuario_responsavel_id,
        metadata
    ) values (
        p_empresa_id,
        v_assinatura.plano_id,
        v_assinatura.plano_id,
        v_assinatura.valor,
        v_assinatura.valor,
        'pagamento_manual',
        'Pagamento manual de R$ ' || trim(to_char(p_valor, '999G999D99')) || ' (' || upper(coalesce(p_forma_pagamento, 'PIX')) || ') registrado pelo administrador.',
        v_admin_id,
        jsonb_build_object(
            'transacao_id', v_transacao_id,
            'valor', p_valor,
            'data_pagamento', p_data_pagamento,
            'competencia', p_competencia,
            'proximo_vencimento', p_proximo_vencimento
        )
    );

    return jsonb_build_object(
        'success', true,
        'transacao_id', v_transacao_id,
        'message', 'Pagamento registrado e assinatura atualizada com sucesso.'
    );
end;
$$;

-- 8. RPC: atualizar_assinatura_manual_admin (ações de controle: suspender, reativar, cancelar, alterar valores/datas/plano)
CREATE OR REPLACE FUNCTION public.atualizar_assinatura_manual_admin(
    p_empresa_id uuid,
    p_acao text, -- 'suspender', 'reativar', 'cancelar', 'alterar_dados', 'estender_teste'
    p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_admin_id uuid;
    v_assinatura record;
    v_novo_plano record;
    v_plano_id uuid;
    v_valor numeric;
    v_desconto numeric;
    v_vencimento date;
    v_periodicidade text;
    v_forma_pagamento text;
    v_fim_teste date;
    v_motivo text;
    v_observacao text;
    v_tipo_log text := 'alteracao_administrativa';
    v_descricao_log text := 'Alteração na assinatura pelo Platform Admin.';
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    select id into v_admin_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and perfil = 'platform_admin'
      and ativo = true
    limit 1;

    select *
    into v_assinatura
    from public.assinaturas
    where empresa_id = p_empresa_id
    for update;

    if v_assinatura.id is null then
        return jsonb_build_object('success', false, 'error', 'Assinatura não encontrada para esta empresa.');
    end if;

    if p_acao = 'suspender' then
        v_motivo := coalesce(p_payload->>'motivo', 'Inadimplência');
        v_observacao := p_payload->>'observacao';

        update public.assinaturas
        set 
            status = 'suspensa',
            motivo_suspensao = v_motivo,
            observacao_suspensao = v_observacao,
            updated_at = now()
        where id = v_assinatura.id;

        update public.empresas
        set status = 'suspenso', updated_at = now()
        where id = p_empresa_id;

        v_tipo_log := 'suspensao';
        v_descricao_log := 'Assinatura suspensa por: ' || v_motivo || coalesce('. Obs: ' || v_observacao, '');

    elsif p_acao = 'reativar' then
        update public.assinaturas
        set 
            status = 'ativa',
            cancelada_em = null,
            motivo_suspensao = null,
            observacao_suspensao = null,
            motivo_cancelamento = null,
            observacao_cancelamento = null,
            vencimento = coalesce((p_payload->>'vencimento')::date, (CURRENT_DATE + interval '30 days')::date),
            proxima_cobranca = coalesce((p_payload->>'vencimento')::date, (CURRENT_DATE + interval '30 days')::date),
            updated_at = now()
        where id = v_assinatura.id;

        update public.empresas
        set status = 'ativo', updated_at = now()
        where id = p_empresa_id;

        v_tipo_log := 'reativacao';
        v_descricao_log := 'Assinatura e empresa reativadas com sucesso.';

    elsif p_acao = 'cancelar' then
        v_motivo := coalesce(p_payload->>'motivo', 'Solicitação do cliente');
        v_observacao := p_payload->>'observacao';

        update public.assinaturas
        set 
            status = 'cancelada',
            cancelada_em = now(),
            motivo_cancelamento = v_motivo,
            observacao_cancelamento = v_observacao,
            responsavel_cancelamento_id = v_admin_id,
            updated_at = now()
        where id = v_assinatura.id;

        update public.empresas
        set status = 'cancelado', updated_at = now()
        where id = p_empresa_id;

        v_tipo_log := 'cancelamento';
        v_descricao_log := 'Assinatura cancelada por: ' || v_motivo || coalesce('. Obs: ' || v_observacao, '');

    elsif p_acao = 'estender_teste' then
        v_fim_teste := (p_payload->>'fim_periodo_teste')::date;
        if v_fim_teste is null or v_fim_teste < CURRENT_DATE then
            return jsonb_build_object('success', false, 'error', 'Data de término do teste inválida.');
        end if;

        update public.assinaturas
        set 
            status = 'trial',
            fim_periodo_teste = v_fim_teste,
            vencimento = v_fim_teste,
            proxima_cobranca = v_fim_teste,
            updated_at = now()
        where id = v_assinatura.id;

        update public.empresas
        set status = 'ativo', updated_at = now()
        where id = p_empresa_id;

        v_tipo_log := 'extensao_teste';
        v_descricao_log := 'Período de teste estendido até ' || to_char(v_fim_teste, 'DD/MM/YYYY') || '.';

    elsif p_acao = 'alterar_dados' then
        -- Se alterou plano
        if p_payload ? 'plano_slug' and trim(p_payload->>'plano_slug') <> '' then
            select * into v_novo_plano from public.planos where slug = trim(p_payload->>'plano_slug') limit 1;
            if v_novo_plano.id is not null then
                v_plano_id := v_novo_plano.id;
            end if;
        end if;
        if v_plano_id is null then
            v_plano_id := v_assinatura.plano_id;
        end if;

        v_valor := coalesce((p_payload->>'valor')::numeric, v_assinatura.valor);
        v_desconto := coalesce((p_payload->>'desconto')::numeric, v_assinatura.desconto, 0);
        v_vencimento := coalesce((p_payload->>'vencimento')::date, v_assinatura.vencimento);
        v_periodicidade := coalesce(p_payload->>'periodicidade', v_assinatura.periodicidade);
        v_forma_pagamento := coalesce(p_payload->>'metodo_pagamento', v_assinatura.metodo_pagamento);
        v_fim_teste := (p_payload->>'fim_periodo_teste')::date;

        update public.assinaturas
        set 
            plano_id = v_plano_id,
            valor = v_valor,
            desconto = v_desconto,
            vencimento = v_vencimento,
            proxima_cobranca = v_vencimento,
            periodicidade = v_periodicidade,
            metodo_pagamento = v_forma_pagamento,
            fim_periodo_teste = v_fim_teste,
            observacoes_comerciais = coalesce(p_payload->>'observacoes_comerciais', observacoes_comerciais),
            updated_at = now()
        where id = v_assinatura.id;

        v_tipo_log := 'alteracao_contrato';
        v_descricao_log := 'Dados da contratação/plano atualizados pelo Platform Admin.';
    else
        return jsonb_build_object('success', false, 'error', 'Ação desconhecida: ' || p_acao);
    end if;

    -- Inserir log
    insert into public.log_assinaturas (
        empresa_id,
        plano_anterior_id,
        plano_novo_id,
        valor_anterior,
        valor_novo,
        tipo,
        descricao,
        usuario_responsavel_id,
        metadata
    ) values (
        p_empresa_id,
        v_assinatura.plano_id,
        coalesce(v_plano_id, v_assinatura.plano_id),
        v_assinatura.valor,
        coalesce(v_valor, v_assinatura.valor),
        v_tipo_log,
        v_descricao_log,
        v_admin_id,
        p_payload
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Assinatura atualizada com sucesso.'
    );
end;
$$;

-- 9. RPC: editar_empresa_cadastral_admin (Edição administrativa sem afetar plano/limites)
CREATE OR REPLACE FUNCTION public.editar_empresa_cadastral_admin(
    p_empresa_id uuid,
    p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_admin_id uuid;
begin
    if not public.is_platform_admin() then
        return jsonb_build_object('success', false, 'error', 'Acesso negado.');
    end if;

    select id into v_admin_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and perfil = 'platform_admin'
      and ativo = true
    limit 1;

    update public.empresas
    set 
        nome = coalesce(trim(p_dados->>'nome'), nome),
        nome_fantasia = p_dados->>'nome_fantasia',
        cnpj = coalesce(p_dados->>'cnpj', cnpj),
        inscricao_estadual = p_dados->>'inscricao_estadual',
        inscricao_municipal = p_dados->>'inscricao_municipal',
        email = p_dados->>'email',
        telefone = p_dados->>'telefone',
        whatsapp = p_dados->>'whatsapp',
        cep = p_dados->>'cep',
        estado = p_dados->>'estado',
        cidade = p_dados->>'cidade',
        bairro = p_dados->>'bairro',
        endereco = p_dados->>'endereco',
        numero = p_dados->>'numero',
        complemento = p_dados->>'complemento',
        observacoes = p_dados->>'observacoes',
        responsavel_nome = p_dados->>'responsavel_nome',
        responsavel_cpf = p_dados->>'responsavel_cpf',
        responsavel_email = p_dados->>'responsavel_email',
        responsavel_telefone = p_dados->>'responsavel_telefone',
        responsavel_whatsapp = p_dados->>'responsavel_whatsapp',
        responsavel_cargo = p_dados->>'responsavel_cargo',
        status = coalesce(p_dados->>'status', status),
        updated_at = now()
    where id = p_empresa_id;

    -- Log
    insert into public.log_assinaturas (
        empresa_id,
        tipo,
        descricao,
        usuario_responsavel_id,
        metadata
    ) values (
        p_empresa_id,
        'edicao_cadastral',
        'Dados cadastrais da empresa atualizados pelo Platform Admin.',
        v_admin_id,
        p_dados
    );

    return jsonb_build_object('success', true, 'message', 'Dados cadastrais atualizados com sucesso.');
end;
$$;

-- 10. RPC: listar_historico_empresa_admin(p_empresa_id uuid)
CREATE OR REPLACE FUNCTION public.listar_historico_empresa_admin(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_historico jsonb;
begin
    if not public.is_platform_admin() then
        raise exception 'Acesso negado.';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', l.id,
                'empresa_id', l.empresa_id,
                'plano_anterior_nome', pa.nome,
                'plano_novo_nome', pn.nome,
                'valor_anterior', l.valor_anterior,
                'valor_novo', l.valor_novo,
                'tipo', l.tipo,
                'descricao', l.descricao,
                'usuario_nome', u.nome,
                'created_at', l.created_at,
                'metadata', l.metadata
            ) order by l.created_at desc
        ),
        '[]'::jsonb
    ) into v_historico
    from public.log_assinaturas l
    left join public.planos pa on pa.id = l.plano_anterior_id
    left join public.planos pn on pn.id = l.plano_novo_id
    left join public.usuarios u on u.id = l.usuario_responsavel_id
    where l.empresa_id = p_empresa_id;

    return v_historico;
end;
$$;
