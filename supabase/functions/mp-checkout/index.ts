import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido. Utilize POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const appUrl = Deno.env.get('APP_URL') || 'https://evogestao.com.br'

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        error: 'Configuração do servidor incompleta (service_role ausente).',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Corpo da requisição inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { plano_slug, empresa_id: requestedEmpresaId } = body || {}

    if (!plano_slug) {
      return new Response(JSON.stringify({ error: 'O parâmetro plano_slug é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    let resolvedEmpresaId: string | null = null
    let resolvedUserEmail: string | null = null
    let resolvedUserName: string | null = null

    // 1. Tentar resolver usuário autenticado via Authorization header
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim()
      if (token) {
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
        if (!userError && userData?.user) {
          const authUserId = userData.user.id
          resolvedUserEmail = userData.user.email || null

          // Buscar usuário em public.usuarios
          const { data: dbUser } = await supabaseAdmin
            .from('usuarios')
            .select('id, empresa_id, nome, perfil')
            .eq('auth_user_id', authUserId)
            .eq('ativo', true)
            .maybeSingle()

          if (dbUser) {
            resolvedEmpresaId = dbUser.empresa_id
            resolvedUserName = dbUser.nome
          }
        }
      }
    }

    // 2. Se não encontrou pelo token mas veio empresa_id no corpo (fluxo de setup/onboarding com empresa criada)
    if (!resolvedEmpresaId && requestedEmpresaId) {
      resolvedEmpresaId = requestedEmpresaId
    }

    if (!resolvedEmpresaId) {
      return new Response(
        JSON.stringify({
          error: 'Identificação da empresa não encontrada. Faça login para continuar.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // 3. Buscar dados da Empresa
    const { data: empresa, error: empresaErr } = await supabaseAdmin
      .from('empresas')
      .select('id, nome, nome_fantasia, email, cnpj, telefone')
      .eq('id', resolvedEmpresaId)
      .maybeSingle()

    if (empresaErr || !empresa) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada no sistema.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // 4. Buscar dados do Plano (preço SEMPRE resolvido no backend)
    const { data: plano, error: planoErr } = await supabaseAdmin
      .from('planos')
      .select('id, nome, slug, valor_mensal, descricao, ativo')
      .eq('slug', plano_slug.trim().toLowerCase())
      .eq('ativo', true)
      .maybeSingle()

    if (planoErr || !plano) {
      return new Response(JSON.stringify({ error: 'Plano não encontrado ou indisponível.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const valorUnitario = Number(plano.valor_mensal)
    const externalReference = `${empresa.id}:${plano.slug}`

    // Base URL para redirecionamento
    const origin = req.headers.get('origin') || appUrl
    const successUrl = `${origin}/checkout/sucesso?status=approved&plano=${plano.slug}`
    const failureUrl = `${origin}/checkout?plano=${plano.slug}&status=failure`
    const pendingUrl = `${origin}/checkout/sucesso?status=pending&plano=${plano.slug}`
    const notificationUrl = `${supabaseUrl}/functions/v1/mp-webhook`

    // 5. Se não tiver MP_ACCESS_TOKEN configurado em produção/desenvolvimento,
    // gerar fallback simulado de Sandbox para testes locais/demo
    if (!mpAccessToken) {
      console.warn(
        'mp-checkout: MP_ACCESS_TOKEN não configurado. Retornando link simulado de checkout.',
      )
      const simulatedInitPoint = `${origin}/checkout/sucesso?status=approved&plano=${plano.slug}&simulated=true&empresa=${empresa.id}`
      return new Response(
        JSON.stringify({
          init_point: simulatedInitPoint,
          sandbox_init_point: simulatedInitPoint,
          external_reference: externalReference,
          plano: {
            id: plano.id,
            nome: plano.nome,
            valor: valorUnitario,
          },
          simulated: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // 6. Criar preferência na API do Mercado Pago
    const preferencePayload = {
      items: [
        {
          id: plano.id,
          title: `EVO Gestão - Plano ${plano.nome}`,
          description: plano.descricao || `Assinatura mensal do plano ${plano.nome} no EVO Gestão`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: valorUnitario,
        },
      ],
      payer: {
        name: resolvedUserName || empresa.nome_fantasia || empresa.nome,
        email: empresa.email || resolvedUserEmail || 'contato@distribuidora.com.br',
      },
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        pending: pendingUrl,
        failure: failureUrl,
      },
      auto_return: 'approved',
      notification_url: notificationUrl,
      statement_descriptor: 'EVO GESTAO',
      payment_methods: {
        excluded_payment_types: [],
        installments: 12,
      },
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preferencePayload),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('mp-checkout: Erro na API do Mercado Pago', mpData)
      return new Response(
        JSON.stringify({
          error: mpData?.message || 'Erro ao gerar preferência de checkout no Mercado Pago.',
          details: mpData,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    return new Response(
      JSON.stringify({
        id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point || mpData.init_point,
        external_reference: externalReference,
        plano: {
          id: plano.id,
          nome: plano.nome,
          valor: valorUnitario,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  } catch (err: any) {
    console.error('mp-checkout: Erro não tratado', err)
    return new Response(
      JSON.stringify({
        error: err?.message || 'Erro interno ao processar checkout.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }
})
