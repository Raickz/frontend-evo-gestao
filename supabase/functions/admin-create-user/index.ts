import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const PERFIS_PERMITIDOS = ['master', 'admin', 'gerente', 'vendedor', 'operador']

Deno.serve(async (req: Request) => {
  // Tratar requisições OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Método não permitido. Utilize POST.' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Configuração do servidor incompleta (service_role_key ausente).',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Obter header de Autorização
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Token de autenticação não fornecido.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    // Cliente com contexto da requisição / usuário logado para validar token
    const clientKey = supabaseAnonKey || supabaseServiceKey
    const supabaseUserClient = createClient(supabaseUrl, clientKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    })

    const {
      data: { user: callerUser },
      error: userAuthError,
    } = await supabaseUserClient.auth.getUser(token)

    if (userAuthError || !callerUser) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Sessão inválida ou expirada.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Cliente Admin com Service Role para consultas e operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Consultar perfil e empresa_id do usuário que está chamando
    const { data: usuarioCaller, error: callerFetchError } = await supabaseAdmin
      .from('usuarios')
      .select('id, empresa_id, perfil, ativo')
      .eq('auth_user_id', callerUser.id)
      .single()

    if (callerFetchError || !usuarioCaller) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Usuário não encontrado na base do sistema.' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    if (!usuarioCaller.ativo) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Seu usuário está inativo.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const callerPerfil = (usuarioCaller.perfil || '').toLowerCase().trim()
    const isPlatformAdmin = callerPerfil === 'platform_admin'

    if (!isPlatformAdmin && callerPerfil !== 'master' && callerPerfil !== 'admin') {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Apenas usuários Master, Administrador ou Platform Admin têm permissão para criar usuários.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Se NÃO for platform_admin, valida status de assinatura da empresa
    if (!isPlatformAdmin) {
      const { data: statusAssinatura, error: statusAssError } =
        await supabaseUserClient.rpc('get_status_assinatura')

      if (
        statusAssError ||
        !statusAssinatura ||
        (statusAssinatura as any).acesso_permitido !== true
      ) {
        const motivo =
          (statusAssinatura as any)?.motivo_bloqueio ||
          'Seu período de teste terminou. Para continuar utilizando o EVO Gestão, acesse a página de planos e escolha uma assinatura.'
        return new Response(
          JSON.stringify({
            sucesso: false,
            erro: motivo,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          },
        )
      }
    }

    // Validar limite de usuários do plano atomicamente via RPC
    const { data: validacaoLimite, error: limiteErr } = await supabaseAdmin.rpc(
      'validar_limite_usuarios',
      { p_empresa_id: empresaId },
    )

    if (limiteErr) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: limiteErr.message || 'Erro ao validar limites do plano.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    if (validacaoLimite && validacaoLimite.permitido === false) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro:
            validacaoLimite.erro ||
            'Limite de usuários do plano atingido. Faça upgrade do seu plano para adicionar novos usuários.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Extrair e validar o payload
    let body: any
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Corpo da requisição inválido.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Determinar target empresaId: se for platform_admin, pode passar empresa_id explicitamente no payload
    let empresaId = usuarioCaller.empresa_id
    if (isPlatformAdmin && body?.empresa_id) {
      empresaId = body.empresa_id
    }

    if (!empresaId) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Empresa de destino do usuário não informada.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Se NÃO for platform_admin, validar limites do plano da empresa
    if (!isPlatformAdmin) {
      const { data: validacaoLimite, error: limiteErr } = await supabaseAdmin.rpc(
        'validar_limite_usuarios',
        { p_empresa_id: empresaId },
      )

      if (limiteErr) {
        return new Response(
          JSON.stringify({
            sucesso: false,
            erro: limiteErr.message || 'Erro ao validar limites do plano.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          },
        )
      }

      if (validacaoLimite && validacaoLimite.permitido === false) {
        return new Response(
          JSON.stringify({
            sucesso: false,
            erro:
              validacaoLimite.erro ||
              'Limite de usuários do plano atingido. Faça upgrade do seu plano para adicionar novos usuários.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          },
        )
      }
    }

    const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const perfil = typeof body?.perfil === 'string' ? body.perfil.trim().toLowerCase() : ''
    const senha = typeof body?.senha === 'string' ? body.senha : ''
    const telefone = typeof body?.telefone === 'string' ? body.telefone.trim() : null

    if (!nome) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Nome é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Informe um e-mail válido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (!PERFIS_PERMITIDOS.includes(perfil)) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: `Perfil inválido. Deve ser um dos seguintes: ${PERFIS_PERMITIDOS.join(', ')}.`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    if (!senha || senha.length < 6) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'A senha é obrigatória e deve ter no mínimo 6 caracteres.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Regra de segurança: Admin não pode criar usuário Master
    if (callerPerfil === 'admin' && perfil === 'master') {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Apenas usuários Master podem criar outros usuários Master.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Criar auth user via Supabase Admin API
    const { data: authCreated, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })

    if (createError || !authCreated?.user) {
      const msg = createError?.message || ''
      let userFriendlyError = 'Falha ao criar usuário de autenticação.'

      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('email exists')
      ) {
        userFriendlyError = 'Já existe um usuário com este e-mail.'
      } else if (msg) {
        userFriendlyError = msg
      }

      return new Response(JSON.stringify({ sucesso: false, erro: userFriendlyError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const newAuthUserId = authCreated.user.id

    // Inserir registro em public.usuarios com empresa_id obtido com segurança do JWT
    const { data: usuarioInserido, error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_user_id: newAuthUserId,
        empresa_id: empresaId,
        nome,
        email,
        telefone,
        perfil,
        ativo: true,
      })
      .select('id, auth_user_id, empresa_id, nome, email, perfil, ativo, created_at')
      .single()

    if (insertError) {
      // Rollback: deletar o usuário de auth.users criado anteriormente
      try {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUserId)
      } catch {
        // Ignorar erro do rollback para repassar o erro original
      }

      let userFriendlyError = 'Falha ao salvar registro do usuário na empresa.'
      const insertMsg = insertError.message || ''
      if (
        insertMsg.toLowerCase().includes('duplicate') ||
        insertMsg.toLowerCase().includes('unique')
      ) {
        userFriendlyError = 'Já existe um registro com este e-mail.'
      }

      return new Response(JSON.stringify({ sucesso: false, erro: userFriendlyError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        usuario: {
          id: usuarioInserido.id,
          auth_user_id: usuarioInserido.auth_user_id,
          nome: usuarioInserido.nome,
          email: usuarioInserido.email,
          perfil: usuarioInserido.perfil,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: err?.message || 'Erro interno ao processar criação do usuário.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }
})
