-- Migration: 20260840000000_rollback_empresa_manual_admin.sql
-- RPC de compensação e rollback seguro para o Platform Admin caso a criação do usuário Master falhe no Edge Function

CREATE OR REPLACE FUNCTION public.rollback_empresa_manual_admin(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
    v_admin_id uuid;
    v_usuarios_count integer;
    v_vendas_count integer;
begin
    -- 1. Validar se o chamador é platform_admin
    if not public.is_platform_admin() then
        return jsonb_build_object(
            'success', false,
            'error', 'Acesso negado: apenas administradores da plataforma podem executar rollback de empresa.'
        );
    end if;

    if p_empresa_id is null then
        return jsonb_build_object('success', false, 'error', 'ID da empresa não informado.');
    end if;

    select id into v_admin_id
    from public.usuarios
    where auth_user_id = auth.uid()
      and perfil = 'platform_admin'
      and ativo = true
    limit 1;

    -- 2. Regra de segurança: só permitir rollback se a empresa NÃO tiver movimentações operacionais (vendas, etc.)
    select count(*) into v_vendas_count
    from public.vendas
    where empresa_id = p_empresa_id;

    if v_vendas_count > 0 then
        return jsonb_build_object(
            'success', false,
            'error', 'Não é possível remover a empresa pois já existem vendas registradas.'
        );
    end if;

    -- 3. Remover registros de log de assinaturas da empresa
    delete from public.log_assinaturas where empresa_id = p_empresa_id;

    -- 4. Remover transações da empresa
    delete from public.transacoes where empresa_id = p_empresa_id;

    -- 5. Remover assinaturas da empresa
    delete from public.assinaturas where empresa_id = p_empresa_id;

    -- 6. Remover usuários da tabela usuarios (se algum foi criado)
    delete from public.usuarios where empresa_id = p_empresa_id;

    -- 7. Remover a empresa
    delete from public.empresas where id = p_empresa_id;

    return jsonb_build_object(
        'success', true,
        'message', 'Rollback concluído com sucesso. Registros vinculados removidos.'
    );
end;
$$;
