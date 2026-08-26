import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Validação de Assinatura x-signature do Mercado Pago
 */
async function verifyMercadoPagoSignature(
  xSignature: string | null,
  dataId: string,
  secret: string | null,
): Promise<boolean> {
  if (!secret) {
    // Se não houver secret configurado (ambiente dev), aceita com warning
    console.warn('mp-webhook: MP_WEBHOOK_SECRET ausente, ignorando validação HMAC em dev.')
    return true
  }

  if (!xSignature) {
    return false
  }

  try {
    // x-signature formato: ts=12345678,v1=hash
    const parts = xSignature.split(',')
    let ts = ''
    let hash = ''

    for (const part of parts) {
      const [k, v] = part.split('=')
      if (k?.trim() === 'ts') ts = v?.trim()
      if (k?.trim() === 'v1') hash = v?.trim()
    }

    if (!ts || !hash) {
      return false
    }

    const manifest = `id:${dataId};request-id:;ts:${ts};`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(manifest)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const hashHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return hashHex === hash
  } catch (err) {
    console.error('mp-webhook: Erro ao calcular HMAC signature', err)
    return false
  }
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Mercado Pago pode enviar GET para testar endpoint ou POST para eventos
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', service: 'mp-webhook' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const mpWebhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('mp-webhook: Variáveis de ambiente do Supabase não configuradas.')
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      console.warn('mp-webhook: Não foi possível parsear corpo JSON')
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Extrair ID do pagamento e tipo do evento
    // Formato Mercado Pago: { action: "payment.created"|"payment.updated", data: { id: "12345" }, type: "payment" }
    const eventType = body?.type || body?.topic || body?.action
    const paymentId =
      body?.data?.id || body?.id || (body?.resource ? body.resource.split('/').pop() : null)

    if (!paymentId) {
      console.log('mp-webhook: Notificação sem ID de pagamento relevante:', body)
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const strPaymentId = String(paymentId)

    // Validação de assinatura HMAC
    const xSignature = req.headers.get('x-signature')
    const isValidSignature = await verifyMercadoPagoSignature(
      xSignature,
      strPaymentId,
      mpWebhookSecret,
    )
    if (!isValidSignature) {
      console.warn('mp-webhook: Assinatura inválida para paymentId:', strPaymentId)
      // MP recomenda retornar 200 mesmo se ignorar para evitar retentativas desnecessárias
      return new Response(JSON.stringify({ received: true, ignored: 'invalid_signature' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // IDEMPOTÊNCIA: Verificar se já existe transação processada para este gateway_id com status final
    const { data: existingTx } = await supabaseAdmin
      .from('transacoes')
      .select('id, status, gateway_id, empresa_id')
      .eq('gateway_id', strPaymentId)
      .maybeSingle()

    // Se já foi aprovado anteriormente, idempotência total -> 200 OK sem alterar
    if (existingTx && existingTx.status === 'aprovado') {
      console.log(
        `mp-webhook: Pagamento ${strPaymentId} já processado anteriormente como 'aprovado'. Idempotente.`,
      )
      return new Response(JSON.stringify({ received: true, idempotent: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Buscar detalhes do pagamento na API do Mercado Pago
    let paymentDetails: any = null
    if (mpAccessToken) {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${strPaymentId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json',
          },
        })
        if (mpRes.ok) {
          paymentDetails = await mpRes.json()
        } else {
          console.error(
            `mp-webhook: Falha ao buscar detalhes do pagamento ${strPaymentId} no MP`,
            await mpRes.text(),
          )
        }
      } catch (fetchErr) {
        console.error('mp-webhook: Erro na requisição à API do MP:', fetchErr)
      }
    } else {
      console.warn(
        'mp-webhook: MP_ACCESS_TOKEN ausente. Usando payload do webhook ou dados mock se disponíveis.',
      )
      // Se enviado em modo de simulação / teste
      if (body?.simulated_payment) {
        paymentDetails = body.simulated_payment
      }
    }

    if (!paymentDetails) {
      console.warn(`mp-webhook: Não foi possível obter detalhes do pagamento ${strPaymentId}`)
      return new Response(
        JSON.stringify({ received: true, warning: 'payment_details_unavailable' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    const mpStatus = paymentDetails.status // 'approved', 'rejected', 'pending', 'cancelled', 'refunded'
    const transactionAmount = Number(paymentDetails.transaction_amount || 0)
    const paymentMethodType =
      paymentDetails.payment_type_id || paymentDetails.payment_method_id || 'pix'
    const externalRef = paymentDetails.external_reference || '' // "empresa_id:plano_slug"

    let parsedEmpresaId: string | null = null
    let parsedPlanoSlug: string | null = null

    if (externalRef && externalRef.includes(':')) {
      const [empId, pSlug] = externalRef.split(':')
      parsedEmpresaId = empId?.trim() || null
      parsedPlanoSlug = pSlug?.trim() || null
    }

    if (!parsedEmpresaId) {
      console.error(
        `mp-webhook: external_reference inválido (${externalRef}) no pagamento ${strPaymentId}`,
      )
      return new Response(JSON.stringify({ received: true, error: 'invalid_external_reference' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Buscar empresa
    const { data: empresa } = await supabaseAdmin
      .from('empresas')
      .select('id, nome')
      .eq('id', parsedEmpresaId)
      .maybeSingle()

    if (!empresa) {
      console.error(`mp-webhook: Empresa ${parsedEmpresaId} não encontrada no banco`)
      return new Response(JSON.stringify({ received: true, error: 'empresa_not_found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Buscar plano
    let planoRecord: any = null
    if (parsedPlanoSlug) {
      const { data: p } = await supabaseAdmin
        .from('planos')
        .select('id, nome, slug, valor_mensal')
        .eq('slug', parsedPlanoSlug)
        .maybeSingle()
      planoRecord = p
    }

    // Mapear status do MP para status da tabela transacoes
    let localStatus = 'pendente'
    if (mpStatus === 'approved') localStatus = 'aprovado'
    else if (mpStatus === 'rejected') localStatus = 'recusado'
    else if (mpStatus === 'cancelled') localStatus = 'cancelado'
    else if (mpStatus === 'refunded') localStatus = 'reembolsado'
    else localStatus = 'pendente'

    // Buscar assinatura existente da empresa
    const { data: assinaturaExistente } = await supabaseAdmin
      .from('assinaturas')
      .select('id, plano_id, status, valor, inicio, vencimento, proxima_cobranca')
      .eq('empresa_id', parsedEmpresaId)
      .maybeSingle()

    let finalAssinaturaId = assinaturaExistente?.id || null

    // 1. Criar ou Atualizar Transação
    let transacaoId: string | null = existingTx?.id || null

    if (existingTx) {
      const { data: updatedTx, error: txUpErr } = await supabaseAdmin
        .from('transacoes')
        .update({
          gateway_status: mpStatus,
          status: localStatus,
          metodo_pagamento: paymentMethodType,
          valor: transactionAmount,
          metadata: paymentDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTx.id)
        .select('id')
        .single()

      if (!txUpErr && updatedTx) transacaoId = updatedTx.id
    } else {
      const { data: newTx, error: txInsErr } = await supabaseAdmin
        .from('transacoes')
        .insert({
          empresa_id: parsedEmpresaId,
          assinatura_id: finalAssinaturaId,
          plano_id: planoRecord?.id || null,
          valor: transactionAmount,
          gateway: 'mercadopago',
          gateway_id: strPaymentId,
          gateway_status: mpStatus,
          metodo_pagamento: paymentMethodType,
          status: localStatus,
          external_reference: externalRef,
          metadata: paymentDetails,
        })
        .select('id')
        .single()

      if (!txInsErr && newTx) transacaoId = newTx.id
    }

    // 2. Se status for 'approved' (aprovado), atualizar / ativar assinatura
    if (mpStatus === 'approved') {
      const hoje = new Date()
      const vencimento = new Date(hoje)
      vencimento.setDate(vencimento.getDate() + 30)

      const hojeStr = hoje.toISOString().split('T')[0]
      const vencimentoStr = vencimento.toISOString().split('T')[0]

      const chosenPlanoId = planoRecord?.id || assinaturaExistente?.plano_id
      const chosenValor = planoRecord ? Number(planoRecord.valor_mensal) : transactionAmount

      if (!assinaturaExistente) {
        // Criar nova assinatura ativa
        const { data: novaAssinatura, error: novaAssErr } = await supabaseAdmin
          .from('assinaturas')
          .insert({
            empresa_id: parsedEmpresaId,
            plano_id: chosenPlanoId,
            valor: chosenValor,
            status: 'ativa',
            inicio: hojeStr,
            vencimento: vencimentoStr,
            proxima_cobranca: vencimentoStr,
            gateway: 'mercadopago',
            metodo_pagamento: paymentMethodType,
            ultimo_pagamento_id: transacaoId,
          })
          .select('id')
          .single()

        if (!novaAssErr && novaAssinatura) {
          finalAssinaturaId = novaAssinatura.id

          // Atualizar transação com a assinatura_id criada
          if (transacaoId) {
            await supabaseAdmin
              .from('transacoes')
              .update({ assinatura_id: finalAssinaturaId })
              .eq('id', transacaoId)
          }

          // Registrar no log_assinaturas
          await supabaseAdmin.from('log_assinaturas').insert({
            empresa_id: parsedEmpresaId,
            plano_anterior_id: null,
            plano_novo_id: chosenPlanoId,
            valor_anterior: null,
            valor_novo: chosenValor,
            tipo: 'pagamento_aprovado',
          })
        }
      } else {
        // Atualizar assinatura existente (trial -> ativa ou renovação de ativa/atrasada)
        const planoAnteriorId = assinaturaExistente.plano_id
        const valorAnterior = assinaturaExistente.valor

        await supabaseAdmin
          .from('assinaturas')
          .update({
            plano_id: chosenPlanoId,
            valor: chosenValor,
            status: 'ativa',
            inicio: assinaturaExistente.inicio || hojeStr,
            vencimento: vencimentoStr,
            proxima_cobranca: vencimentoStr,
            gateway: 'mercadopago',
            metodo_pagamento: paymentMethodType,
            ultimo_pagamento_id: transacaoId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assinaturaExistente.id)

        // Registrar no log_assinaturas
        await supabaseAdmin.from('log_assinaturas').insert({
          empresa_id: parsedEmpresaId,
          plano_anterior_id: planoAnteriorId,
          plano_novo_id: chosenPlanoId,
          valor_anterior: valorAnterior,
          valor_novo: chosenValor,
          tipo: 'pagamento_aprovado',
        })
      }
    } else if (mpStatus === 'rejected') {
      // Se pagamento recusado, registrar no log
      await supabaseAdmin.from('log_assinaturas').insert({
        empresa_id: parsedEmpresaId,
        plano_anterior_id: assinaturaExistente?.plano_id || null,
        plano_novo_id: planoRecord?.id || assinaturaExistente?.plano_id || null,
        valor_anterior: assinaturaExistente?.valor || null,
        valor_novo: transactionAmount,
        tipo: 'pagamento_recusado',
      })
    } else if (mpStatus === 'refunded') {
      // Se estornado, registrar no log
      await supabaseAdmin.from('log_assinaturas').insert({
        empresa_id: parsedEmpresaId,
        plano_anterior_id: assinaturaExistente?.plano_id || null,
        plano_novo_id: planoRecord?.id || assinaturaExistente?.plano_id || null,
        valor_anterior: assinaturaExistente?.valor || null,
        valor_novo: transactionAmount,
        tipo: 'pagamento_reembolsado',
      })
    }

    console.log(
      `mp-webhook: Evento processado com sucesso para paymentId=${strPaymentId}, status=${localStatus}`,
    )

    return new Response(JSON.stringify({ received: true, processed: true, status: localStatus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err: any) {
    console.error('mp-webhook: Erro não tratado:', err)
    // Retornar 200 para o Mercado Pago não travar retry loops
    return new Response(JSON.stringify({ received: true, error: err?.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
