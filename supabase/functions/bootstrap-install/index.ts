import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // Tratar requisições OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  // ==========================================
  // GET: Verificar se o sistema já possui um Master
  // ==========================================
  if (req.method === 'GET') {
    try {
      const { data: masterUser, error } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('perfil', 'master')
        .limit(1)
        .maybeSingle()

      if (error) {
        return new Response(
          JSON.stringify({
            bootstrapped: false,
            erro: 'Erro ao verificar status do sistema.',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          },
        )
      }

      return new Response(
        JSON.stringify({
          bootstrapped: !!masterUser,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    } catch {
      return new Response(
        JSON.stringify({
          bootstrapped: false,
          erro: 'Erro interno ao verificar bootstrap.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }
  }

  // ==========================================
  // Se não for GET nem POST -> 405 Method Not Allowed
  // ==========================================
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Método não permitido. Utilize GET ou POST.' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }

  // ==========================================
  // POST: Executar o bootstrap
  // ==========================================
  let createdEmpresaId: string | null = null
  let createdAuthUserId: string | null = null

  try {
    // 1. Verificar se já existe Master
    const { data: existingMaster, error: masterCheckError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('perfil', 'master')
      .limit(1)
      .maybeSingle()

    if (masterCheckError) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Não foi possível verificar a inicialização do sistema.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    if (existingMaster) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'O sistema já possui um administrador inicial.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // 2. Validar payload
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

    const empresa_nome = typeof body?.empresa_nome === 'string' ? body.empresa_nome.trim() : ''
    const empresa_nome_fantasia =
      typeof body?.empresa_nome_fantasia === 'string' ? body.empresa_nome_fantasia.trim() : ''
    const empresa_cnpj = typeof body?.empresa_cnpj === 'string' ? body.empresa_cnpj.trim() : null
    const empresa_email =
      typeof body?.empresa_email === 'string' ? body.empresa_email.trim().toLowerCase() : null
    const empresa_telefone =
      typeof body?.empresa_telefone === 'string' ? body.empresa_telefone.trim() : null

    const admin_nome = typeof body?.admin_nome === 'string' ? body.admin_nome.trim() : ''
    const admin_email =
      typeof body?.admin_email === 'string' ? body.admin_email.trim().toLowerCase() : ''
    const admin_senha = typeof body?.admin_senha === 'string' ? body.admin_senha : ''

    // Validações obrigatórias
    if (!empresa_nome) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'A Razão Social da empresa é obrigatória.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    if (!empresa_nome_fantasia) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'O Nome Fantasia da empresa é obrigatório.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    if (!admin_nome) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'O nome do administrador é obrigatório.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!admin_email || !emailRegex.test(admin_email)) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Informe um e-mail válido para o administrador.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    if (!admin_senha || admin_senha.length < 6) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'A senha do administrador deve ter no mínimo 6 caracteres.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // 3. Criar empresa em public.empresas
    const { data: empresaCriada, error: empresaError } = await supabaseAdmin
      .from('empresas')
      .insert({
        nome: empresa_nome,
        nome_fantasia: empresa_nome_fantasia,
        cnpj: empresa_cnpj || null,
        email: empresa_email || null,
        telefone: empresa_telefone || null,
        status: 'ativo',
      })
      .select('id, nome, nome_fantasia')
      .single()

    if (empresaError || !empresaCriada) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Não foi possível cadastrar a empresa inicial.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    createdEmpresaId = empresaCriada.id

    // 4. Criar usuário no Auth via supabaseAdmin.auth.admin.createUser
    const { data: authCreated, error: createAuthError } = await supabaseAdmin.auth.admin.createUser(
      {
        email: admin_email,
        password: admin_senha,
        email_confirm: true,
        user_metadata: { nome: admin_nome },
      },
    )

    if (createAuthError || !authCreated?.user) {
      // Rollback: Remover empresa criada
      if (createdEmpresaId) {
        try {
          await supabaseAdmin.from('empresas').delete().eq('id', createdEmpresaId)
        } catch {
          // Rollback silencioso
        }
      }

      const msg = createAuthError?.message || ''
      let userFriendlyError = 'Falha ao criar o usuário administrador.'

      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('email exists')
      ) {
        userFriendlyError = 'Já existe um usuário com este e-mail.'
      }

      return new Response(JSON.stringify({ sucesso: false, erro: userFriendlyError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    createdAuthUserId = authCreated.user.id

    // 5. Inserir em public.usuarios
    const { data: usuarioInserido, error: insertUsuarioError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_user_id: createdAuthUserId,
        empresa_id: createdEmpresaId,
        nome: admin_nome,
        email: admin_email,
        perfil: 'master',
        ativo: true,
      })
      .select('id, auth_user_id, nome, email, perfil')
      .single()

    if (insertUsuarioError || !usuarioInserido) {
      // Rollback: Deletar auth user e empresa criada
      if (createdAuthUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId)
        } catch {
          // Rollback silencioso
        }
      }
      if (createdEmpresaId) {
        try {
          await supabaseAdmin.from('empresas').delete().eq('id', createdEmpresaId)
        } catch {
          // Rollback silencioso
        }
      }

      let userFriendlyError = 'Falha ao registrar o perfil do administrador.'
      const insertMsg = insertUsuarioError?.message || ''
      if (
        insertMsg.toLowerCase().includes('duplicate') ||
        insertMsg.toLowerCase().includes('unique')
      ) {
        userFriendlyError = 'Já existe um usuário com este e-mail.'
      }

      return new Response(JSON.stringify({ sucesso: false, erro: userFriendlyError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Retorno de sucesso
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
        empresa: {
          id: empresaCriada.id,
          nome: empresaCriada.nome,
          nome_fantasia: empresaCriada.nome_fantasia,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  } catch {
    // Rollback de segurança em caso de exceção imprevista
    if (createdAuthUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId)
      } catch {
        // Ignorar
      }
    }
    if (createdEmpresaId) {
      try {
        await supabaseAdmin.from('empresas').delete().eq('id', createdEmpresaId)
      } catch {
        // Ignorar
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: 'Não foi possível configurar o sistema. Verifique sua conexão.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }
})
