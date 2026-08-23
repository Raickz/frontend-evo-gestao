-- Migration: registrar_recebimento RPC
-- Permite dar baixa total ou parcial em contas_receber com bloqueio pessimista (FOR UPDATE) e validações de segurança.

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
BEGIN
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

    -- 12. Retornar JSONB
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
