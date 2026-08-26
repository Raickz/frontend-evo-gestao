import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// IDs FIXOS CONFORME ESPECIFICAÇÃO DEMO PARTE 1 E 2
const DEMO_EMPRESA_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

// Usuários fixos
const USERS_SEED = [
  {
    id: 'ddddddd1-0000-0000-0000-000000000001',
    email: 'master@demo.evogestao.com',
    nome: 'Master Demo',
    perfil: 'master',
    senha: 'Demo@123',
  },
  {
    id: 'ddddddd1-0000-0000-0000-000000000002',
    email: 'admin@demo.evogestao.com',
    nome: 'Admin Demo',
    perfil: 'admin',
    senha: 'Demo@123',
  },
  {
    id: 'ddddddd1-0000-0000-0000-000000000003',
    email: 'vendedor@demo.evogestao.com',
    nome: 'Vendedor Demo',
    perfil: 'vendedor',
    senha: 'Demo@123',
  },
  {
    id: 'ddddddd1-0000-0000-0000-000000000004',
    email: 'operador@demo.evogestao.com',
    nome: 'Operador Demo',
    perfil: 'operador',
    senha: 'Demo@123',
  },
]

// Vendedores fixos
const VENDEDORES_SEED = [
  {
    id: 'ddddddd2-0000-0000-0000-000000000001',
    usuario_id: 'ddddddd1-0000-0000-0000-000000000003', // Vendedor Demo
    nome: 'Vendedor Demo',
    percentual_comissao: 3.0,
    ativo: true,
  },
  {
    id: 'ddddddd2-0000-0000-0000-000000000002',
    usuario_id: 'ddddddd1-0000-0000-0000-000000000001', // Master Demo
    nome: 'Master (como vendedor)',
    percentual_comissao: 5.0,
    ativo: true,
  },
]

// Fornecedores fixos da Parte 1
const FORNECEDOR_1 = 'd0000002-0000-0000-0000-000000000001' // Coca-Cola Distribuidora
const FORNECEDOR_2 = 'd0000002-0000-0000-0000-000000000002' // Atacadão Alimentos

// Clientes fixos da Parte 1
const CLIENTES_SEED = [
  {
    id: 'd0000003-0000-0000-0000-000000000001',
    vendedor_id: 'ddddddd2-0000-0000-0000-000000000001',
  }, // Cliente 1 -> Vendedor 1
  {
    id: 'd0000003-0000-0000-0000-000000000002',
    vendedor_id: 'ddddddd2-0000-0000-0000-000000000001',
  }, // Cliente 2 -> Vendedor 1
  {
    id: 'd0000003-0000-0000-0000-000000000003',
    vendedor_id: 'ddddddd2-0000-0000-0000-000000000002',
  }, // Cliente 3 -> Vendedor 2
  {
    id: 'd0000003-0000-0000-0000-000000000004',
    vendedor_id: 'ddddddd2-0000-0000-0000-000000000002',
  }, // Cliente 4 -> Vendedor 2
  {
    id: 'd0000003-0000-0000-0000-000000000005',
    vendedor_id: 'ddddddd2-0000-0000-0000-000000000001',
  }, // Cliente 5 -> Vendedor 1
]

// Produtos fixos da Parte 1
const PROD_1 = 'd0000004-0000-0000-0000-000000000001'
const PROD_2 = 'd0000004-0000-0000-0000-000000000002'
const PROD_3 = 'd0000004-0000-0000-0000-000000000003'
const PROD_4 = 'd0000004-0000-0000-0000-000000000004'
const PROD_5 = 'd0000004-0000-0000-0000-000000000005'
const PROD_6 = 'd0000004-0000-0000-0000-000000000006'
const PROD_7 = 'd0000004-0000-0000-0000-000000000007'
const PROD_8 = 'd0000004-0000-0000-0000-000000000008'
const PROD_9 = 'd0000004-0000-0000-0000-000000000009'
const PROD_10 = 'd0000004-0000-0000-0000-000000000010'

const VENDEDOR_1 = 'ddddddd2-0000-0000-0000-000000000001'
const VENDEDOR_2 = 'ddddddd2-0000-0000-0000-000000000002'

const MASTER_USER_ID = 'ddddddd1-0000-0000-0000-000000000001'

function getDateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function getDateDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

Deno.serve(async (req: Request) => {
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

  try {
    const summary = {
      empresa_id: DEMO_EMPRESA_ID,
      usuarios_criados: 0,
      usuarios_existentes: 0,
      vendedores_criados: 0,
      vendedores_existentes: 0,
      clientes_atualizados: 0,
      vendas_criadas: 0,
      vendas_existentes: 0,
      pedidos_criados: 0,
      pedidos_existentes: 0,
      compras_criadas: 0,
      compras_existentes: 0,
      contas_pagar_criadas: 0,
      contas_receber_criadas: 0,
    }

    // 0. Carregar produtos existentes do banco para ter precos_venda e precos_custo corretos
    const { data: produtosDb, error: prodErr } = await supabaseAdmin
      .from('produtos')
      .select('id, preco_custo, preco_venda, nome')
      .eq('empresa_id', DEMO_EMPRESA_ID)

    if (prodErr || !produtosDb) {
      throw new Error(
        `Erro ao buscar produtos da empresa Demo: ${prodErr?.message || 'Produtos não encontrados'}`,
      )
    }

    const produtoMap = new Map<string, { preco_custo: number; preco_venda: number; nome: string }>()
    for (const p of produtosDb) {
      produtoMap.set(p.id, {
        preco_custo: Number(p.preco_custo) || 0,
        preco_venda: Number(p.preco_venda) || 0,
        nome: p.nome,
      })
    }

    // =========================================================================
    // 1. USUÁRIOS AUTH + PUBLIC.USUARIOS (Idempotente)
    // =========================================================================
    // Listar usuários auth existentes para verificar idempotência por e-mail
    const { data: listAuthData } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUsers = listAuthData?.users || []

    for (const u of USERS_SEED) {
      // 1.1 Verificar se auth user já existe pelo email
      let authUserId: string | null = null
      const foundAuth = existingAuthUsers.find(
        (au) => au.email?.toLowerCase() === u.email.toLowerCase(),
      )

      if (foundAuth) {
        authUserId = foundAuth.id
      } else {
        const { data: createdAuth, error: createAuthErr } =
          await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.senha,
            email_confirm: true,
            user_metadata: { nome: u.nome },
          })

        if (createAuthErr || !createdAuth?.user) {
          throw new Error(`Falha ao criar Auth User ${u.email}: ${createAuthErr?.message}`)
        }
        authUserId = createdAuth.user.id
      }

      // 1.2 Verificar se usuário já existe em public.usuarios pelo ID fixo
      const { data: existingUsuario } = await supabaseAdmin
        .from('usuarios')
        .select('id, auth_user_id')
        .eq('id', u.id)
        .maybeSingle()

      if (!existingUsuario) {
        const { error: insUserErr } = await supabaseAdmin.from('usuarios').insert({
          id: u.id,
          auth_user_id: authUserId,
          empresa_id: DEMO_EMPRESA_ID,
          nome: u.nome,
          email: u.email,
          perfil: u.perfil,
          ativo: true,
        })

        if (insUserErr) {
          throw new Error(
            `Falha ao inserir usuário ${u.email} na tabela usuarios: ${insUserErr.message}`,
          )
        }
        summary.usuarios_criados++
      } else {
        // Garantir que o auth_user_id está alinhado
        if (existingUsuario.auth_user_id !== authUserId) {
          await supabaseAdmin.from('usuarios').update({ auth_user_id: authUserId }).eq('id', u.id)
        }
        summary.usuarios_existentes++
      }
    }

    // =========================================================================
    // 2. VENDEDORES + ATUALIZAR CLIENTES (Idempotente)
    // =========================================================================
    for (const v of VENDEDORES_SEED) {
      const { data: existingVendedor } = await supabaseAdmin
        .from('vendedores')
        .select('id')
        .eq('id', v.id)
        .maybeSingle()

      if (!existingVendedor) {
        const { error: insVendErr } = await supabaseAdmin.from('vendedores').insert({
          id: v.id,
          empresa_id: DEMO_EMPRESA_ID,
          usuario_id: v.usuario_id,
          nome: v.nome,
          percentual_comissao: v.percentual_comissao,
          ativo: v.ativo,
        })

        if (insVendErr) {
          throw new Error(`Falha ao inserir vendedor ${v.nome}: ${insVendErr.message}`)
        }
        summary.vendedores_criados++
      } else {
        summary.vendedores_existentes++
      }
    }

    // Atualizar clientes associando vendedores
    for (const c of CLIENTES_SEED) {
      const { error: updCliErr } = await supabaseAdmin
        .from('clientes')
        .update({ vendedor_id: c.vendedor_id })
        .eq('id', c.id)
        .eq('empresa_id', DEMO_EMPRESA_ID)

      if (updCliErr) {
        console.warn(`Aviso ao atualizar vendedor do cliente ${c.id}: ${updCliErr.message}`)
      } else {
        summary.clientes_atualizados++
      }
    }

    // =========================================================================
    // 3. VENDAS (8 vendas) + ITENS + COMISSÕES + ESTOQUE + MOVIMENTAÇÕES
    // =========================================================================
    const VENDAS_CONFIG = [
      {
        id: 'ddddddd3-0000-0000-0000-000000000001',
        numero: 1001,
        cliente_id: 'd0000003-0000-0000-0000-000000000001',
        vendedor_id: VENDEDOR_1,
        forma_pagamento: 'pix',
        status: 'finalizada',
        dias_atras: 2,
        itens: [
          { produto_id: PROD_1, qtd: 5, preco: 8.9, custo: 5.5 },
          { produto_id: PROD_2, qtd: 10, preco: 2.5, custo: 1.2 },
        ],
      },
      {
        id: 'ddddddd3-0000-0000-0000-000000000002',
        numero: 1002,
        cliente_id: 'd0000003-0000-0000-0000-000000000002',
        vendedor_id: VENDEDOR_1,
        forma_pagamento: 'dinheiro',
        status: 'finalizada',
        dias_atras: 5,
        itens: [
          { produto_id: PROD_3, qtd: 3, preco: 25.9, custo: 18.0 },
          { produto_id: PROD_4, qtd: 6, preco: 9.9, custo: 6.5 },
          { produto_id: PROD_5, qtd: 4, preco: 7.5, custo: 4.8 },
        ],
      },
      {
        id: 'ddddddd3-0000-0000-0000-000000000003',
        numero: 1003,
        cliente_id: 'd0000003-0000-0000-0000-000000000003',
        vendedor_id: VENDEDOR_2,
        forma_pagamento: 'credito',
        status: 'finalizada',
        dias_atras: 7,
        itens: [
          {
            produto_id: PROD_6,
            qtd: 2,
            preco: produtoMap.get(PROD_6)?.preco_venda ?? 3.5,
            custo: produtoMap.get(PROD_6)?.preco_custo ?? 1.8,
          },
          {
            produto_id: PROD_7,
            qtd: 3,
            preco: produtoMap.get(PROD_7)?.preco_venda ?? 14.9,
            custo: produtoMap.get(PROD_7)?.preco_custo ?? 8.0,
          },
        ],
      },
      {
        id: 'ddddddd3-0000-0000-0000-000000000004',
        numero: 1004,
        cliente_id: 'd0000003-0000-0000-0000-000000000004',
        vendedor_id: VENDEDOR_2,
        forma_pagamento: 'pix',
        status: 'finalizada',
        dias_atras: 10,
        itens: [
          {
            produto_id: PROD_8,
            qtd: 4,
            preco: produtoMap.get(PROD_8)?.preco_venda ?? 8.9,
            custo: produtoMap.get(PROD_8)?.preco_custo ?? 5.0,
          },
          {
            produto_id: PROD_9,
            qtd: 5,
            preco: produtoMap.get(PROD_9)?.preco_venda ?? 6.9,
            custo: produtoMap.get(PROD_9)?.preco_custo ?? 3.5,
          },
        ],
      },
      {
        id: 'ddddddd3-0000-0000-0000-000000000005',
        numero: 1005,
        cliente_id: 'd0000003-0000-0000-0000-000000000005',
        vendedor_id: VENDEDOR_1,
        forma_pagamento: 'debito',
        status: 'finalizada',
        dias_atras: 12,
        itens: [
          {
            produto_id: PROD_10,
            qtd: 8,
            preco: produtoMap.get(PROD_10)?.preco_venda ?? 4.5,
            custo: produtoMap.get(PROD_10)?.preco_custo ?? 2.0,
          },
          { produto_id: PROD_1, qtd: 3, preco: 8.9, custo: 5.5 },
        ],
      },
      {
        id: 'ddddddd3-0000-0000-0000-000000000006',
        numero: 1006,
        cliente_id: 'd0000003-0000-0000-0000-000000000001',
        vendedor_id: VENDEDOR_2,
        forma_pagamento: 'pix',
        status: 'finalizada',
        dias_atras: 15,
        itens: [
          { produto_id: PROD_2, qtd: 20, preco: 2.5, custo: 1.2 },
          { produto_id: PROD_3, qtd: 2, preco: 25.9, custo: 18.0 },
          {
            produto_id: PROD_6,
            qtd: 2,
            preco: produtoMap.get(PROD_6)?.preco_venda ?? 3.5,
            custo: produtoMap.get(PROD_6)?.preco_custo ?? 1.8,
          },
        ],
      },
      {
        id: 'ddddddd3-0000-0000-0000-000000000007',
        numero: 1007,
        cliente_id: 'd0000003-0000-0000-0000-000000000003',
        vendedor_id: VENDEDOR_1,
        forma_pagamento: 'dinheiro',
        status: 'finalizada',
        dias_atras: 20,
        itens: [
          {
            produto_id: PROD_7,
            qtd: 6,
            preco: produtoMap.get(PROD_7)?.preco_venda ?? 14.9,
            custo: produtoMap.get(PROD_7)?.preco_custo ?? 8.0,
          },
        ],
      },
      {
        id: 'ddddddd3-0000-0000-0000-000000000008',
        numero: 1008,
        cliente_id: 'd0000003-0000-0000-0000-000000000004',
        vendedor_id: VENDEDOR_2,
        forma_pagamento: 'credito',
        status: 'finalizada',
        dias_atras: 25,
        itens: [
          { produto_id: PROD_5, qtd: 10, preco: 7.5, custo: 4.8 },
          {
            produto_id: PROD_8,
            qtd: 3,
            preco: produtoMap.get(PROD_8)?.preco_venda ?? 8.9,
            custo: produtoMap.get(PROD_8)?.preco_custo ?? 5.0,
          },
          {
            produto_id: PROD_10,
            qtd: 5,
            preco: produtoMap.get(PROD_10)?.preco_venda ?? 4.5,
            custo: produtoMap.get(PROD_10)?.preco_custo ?? 2.0,
          },
        ],
      },
    ]

    for (const v of VENDAS_CONFIG) {
      const { data: existingVenda } = await supabaseAdmin
        .from('vendas')
        .select('id')
        .eq('id', v.id)
        .maybeSingle()

      if (!existingVenda) {
        // Calcular subtotal e total
        const subtotal = Number(v.itens.reduce((acc, it) => acc + it.qtd * it.preco, 0).toFixed(2))
        const total = subtotal
        const dataVendaStr = getDateDaysAgo(v.dias_atras)
        const createdAtStr = new Date(Date.now() - v.dias_atras * 24 * 60 * 60 * 1000).toISOString()

        // 3.1 Inserir venda
        const { error: insVendaErr } = await supabaseAdmin.from('vendas').insert({
          id: v.id,
          empresa_id: DEMO_EMPRESA_ID,
          cliente_id: v.cliente_id,
          vendedor_id: v.vendedor_id,
          numero: v.numero,
          subtotal,
          desconto: 0,
          total,
          forma_pagamento: v.forma_pagamento,
          status: v.status,
          created_by: MASTER_USER_ID,
          created_at: createdAtStr,
          updated_at: createdAtStr,
        })

        if (insVendaErr) {
          throw new Error(`Falha ao inserir Venda #${v.numero}: ${insVendaErr.message}`)
        }

        // 3.2 Inserir itens_venda + atualizar estoque + movimentação de saída
        for (const it of v.itens) {
          const itemSubtotal = Number((it.qtd * it.preco).toFixed(2))
          const { error: insItemErr } = await supabaseAdmin.from('itens_venda').insert({
            empresa_id: DEMO_EMPRESA_ID,
            venda_id: v.id,
            produto_id: it.produto_id,
            quantidade: it.qtd,
            preco_unitario: it.preco,
            desconto: 0,
            subtotal: itemSubtotal,
            custo_unitario: it.custo,
          })

          if (insItemErr) {
            throw new Error(`Falha ao inserir item da Venda #${v.numero}: ${insItemErr.message}`)
          }

          // Atualizar estoque: subtrair quantidade
          const { data: estAtual } = await supabaseAdmin
            .from('estoques')
            .select('quantidade')
            .eq('empresa_id', DEMO_EMPRESA_ID)
            .eq('produto_id', it.produto_id)
            .maybeSingle()

          if (estAtual) {
            const novaQtd = Number(estAtual.quantidade) - it.qtd
            await supabaseAdmin
              .from('estoques')
              .update({ quantidade: novaQtd, updated_at: createdAtStr })
              .eq('empresa_id', DEMO_EMPRESA_ID)
              .eq('produto_id', it.produto_id)
          }

          // Criar movimentação de estoque: saída
          await supabaseAdmin.from('movimentacoes_estoque').insert({
            empresa_id: DEMO_EMPRESA_ID,
            produto_id: it.produto_id,
            tipo: 'saida',
            quantidade: it.qtd,
            motivo: `Venda #${v.numero}`,
            referencia_id: v.id,
            usuario_id: MASTER_USER_ID,
            created_at: createdAtStr,
          })
        }

        // 3.3 Criar comissão da venda
        const vendedorObj = VENDEDORES_SEED.find((vd) => vd.id === v.vendedor_id)
        const percentual =
          vendedorObj?.percentual_comissao ?? (v.vendedor_id === VENDEDOR_1 ? 3.0 : 5.0)
        const valorComissao = Number(((total * percentual) / 100).toFixed(2))

        await supabaseAdmin.from('comissoes').insert({
          empresa_id: DEMO_EMPRESA_ID,
          vendedor_id: v.vendedor_id,
          venda_id: v.id,
          percentual,
          valor_venda: total,
          valor_comissao: valorComissao,
          status: 'pendente',
          created_at: createdAtStr,
        })

        summary.vendas_criadas++
      } else {
        summary.vendas_existentes++
      }
    }

    // =========================================================================
    // 4. PEDIDOS / ORÇAMENTOS (3 pedidos)
    // =========================================================================
    const PEDIDOS_CONFIG = [
      {
        id: 'ddddddd4-0000-0000-0000-000000000001',
        numero: 2001,
        cliente_id: 'd0000003-0000-0000-0000-000000000002', // Cliente 2
        vendedor_id: VENDEDOR_1,
        status: 'pendente',
        observacoes: 'Orçamento para evento',
        dias_atras: 1,
        itens: [
          { produto_id: PROD_1, qtd: 10, preco: 8.9 },
          { produto_id: PROD_3, qtd: 5, preco: 25.9 },
          { produto_id: PROD_5, qtd: 8, preco: 7.5 },
        ],
      },
      {
        id: 'ddddddd4-0000-0000-0000-000000000002',
        numero: 2002,
        cliente_id: 'd0000003-0000-0000-0000-000000000004', // Cliente 4
        vendedor_id: VENDEDOR_2,
        status: 'confirmado', // aprovado / confirmado no schema
        observacoes: null,
        dias_atras: 3,
        itens: [
          { produto_id: PROD_2, qtd: 50, preco: 2.5 },
          { produto_id: PROD_6, qtd: 4, preco: produtoMap.get(PROD_6)?.preco_venda ?? 3.5 },
        ],
      },
      {
        id: 'ddddddd4-0000-0000-0000-000000000003',
        numero: 2003,
        cliente_id: 'd0000003-0000-0000-0000-000000000001', // Cliente 1
        vendedor_id: VENDEDOR_1,
        status: 'pendente',
        observacoes: null,
        dias_atras: 0,
        itens: [
          { produto_id: PROD_9, qtd: 3, preco: produtoMap.get(PROD_9)?.preco_venda ?? 6.9 },
          { produto_id: PROD_10, qtd: 6, preco: produtoMap.get(PROD_10)?.preco_venda ?? 4.5 },
        ],
      },
    ]

    for (const p of PEDIDOS_CONFIG) {
      const { data: existingPed } = await supabaseAdmin
        .from('pedidos')
        .select('id')
        .eq('id', p.id)
        .maybeSingle()

      if (!existingPed) {
        const total = Number(p.itens.reduce((acc, it) => acc + it.qtd * it.preco, 0).toFixed(2))
        const createdAtStr = new Date(Date.now() - p.dias_atras * 24 * 60 * 60 * 1000).toISOString()

        const { error: insPedErr } = await supabaseAdmin.from('pedidos').insert({
          id: p.id,
          empresa_id: DEMO_EMPRESA_ID,
          cliente_id: p.cliente_id,
          vendedor_id: p.vendedor_id,
          numero: p.numero,
          total,
          status: p.status,
          observacoes: p.observacoes,
          created_at: createdAtStr,
          updated_at: createdAtStr,
        })

        if (insPedErr) {
          throw new Error(`Falha ao inserir Pedido #${p.numero}: ${insPedErr.message}`)
        }

        for (const it of p.itens) {
          const itemSubtotal = Number((it.qtd * it.preco).toFixed(2))
          const { error: insItemPedErr } = await supabaseAdmin.from('itens_pedido').insert({
            empresa_id: DEMO_EMPRESA_ID,
            pedido_id: p.id,
            produto_id: it.produto_id,
            quantidade: it.qtd,
            preco_unitario: it.preco,
            desconto: 0,
            subtotal: itemSubtotal,
          })

          if (insItemPedErr) {
            throw new Error(
              `Falha ao inserir item do Pedido #${p.numero}: ${insItemPedErr.message}`,
            )
          }
        }

        summary.pedidos_criados++
      } else {
        summary.pedidos_existentes++
      }
    }

    // =========================================================================
    // 5. COMPRAS (2 compras) + ITENS + ESTOQUE + MOVIMENTAÇÕES
    // =========================================================================
    const COMPRAS_CONFIG = [
      {
        id: 'ddddddd5-0000-0000-0000-000000000001',
        numero: 3001,
        fornecedor_id: FORNECEDOR_1,
        status: 'confirmada',
        forma_pagamento: 'a_prazo',
        vencimento: getDateDaysFromNow(15),
        data_compra: getDateDaysAgo(10),
        valor_pago: 0,
        dias_atras: 10,
        itens: [
          { produto_id: PROD_1, qtd: 30, preco_unitario: 5.5 },
          { produto_id: PROD_2, qtd: 50, preco_unitario: 1.2 },
        ],
      },
      {
        id: 'ddddddd5-0000-0000-0000-000000000002',
        numero: 3002,
        fornecedor_id: FORNECEDOR_2,
        status: 'confirmada',
        forma_pagamento: 'a_vista',
        vencimento: null,
        data_compra: getDateDaysAgo(5),
        dias_atras: 5,
        itens: [
          { produto_id: PROD_3, qtd: 20, preco_unitario: 18.0 },
          { produto_id: PROD_4, qtd: 15, preco_unitario: 6.5 },
          { produto_id: PROD_5, qtd: 25, preco_unitario: 4.8 },
        ],
      },
    ]

    for (const c of COMPRAS_CONFIG) {
      const { data: existingCompra } = await supabaseAdmin
        .from('compras')
        .select('id')
        .eq('id', c.id)
        .maybeSingle()

      if (!existingCompra) {
        const total = Number(
          c.itens.reduce((acc, it) => acc + it.qtd * it.preco_unitario, 0).toFixed(2),
        )
        const valorPago = c.forma_pagamento === 'a_vista' ? total : (c.valor_pago ?? 0)
        const createdAtStr = new Date(Date.now() - c.dias_atras * 24 * 60 * 60 * 1000).toISOString()

        const { error: insCompraErr } = await supabaseAdmin.from('compras').insert({
          id: c.id,
          empresa_id: DEMO_EMPRESA_ID,
          fornecedor_id: c.fornecedor_id,
          numero: c.numero,
          total,
          status: c.status,
          forma_pagamento: c.forma_pagamento,
          vencimento: c.vencimento,
          data_compra: c.data_compra,
          valor_pago: valorPago,
          created_by: MASTER_USER_ID,
          created_at: createdAtStr,
          updated_at: createdAtStr,
        })

        if (insCompraErr) {
          throw new Error(`Falha ao inserir Compra #${c.numero}: ${insCompraErr.message}`)
        }

        // Itens de compra + estoque + movimentações de entrada
        for (const it of c.itens) {
          const itemSubtotal = Number((it.qtd * it.preco_unitario).toFixed(2))
          const { error: insItemCompErr } = await supabaseAdmin.from('itens_compra').insert({
            empresa_id: DEMO_EMPRESA_ID,
            compra_id: c.id,
            produto_id: it.produto_id,
            quantidade: it.qtd,
            preco_unitario: it.preco_unitario,
            subtotal: itemSubtotal,
          })

          if (insItemCompErr) {
            throw new Error(
              `Falha ao inserir item da Compra #${c.numero}: ${insItemCompErr.message}`,
            )
          }

          // Atualizar estoque: adicionar quantidade comprada
          const { data: estAtual } = await supabaseAdmin
            .from('estoques')
            .select('quantidade')
            .eq('empresa_id', DEMO_EMPRESA_ID)
            .eq('produto_id', it.produto_id)
            .maybeSingle()

          if (estAtual) {
            const novaQtd = Number(estAtual.quantidade) + it.qtd
            await supabaseAdmin
              .from('estoques')
              .update({ quantidade: novaQtd, updated_at: createdAtStr })
              .eq('empresa_id', DEMO_EMPRESA_ID)
              .eq('produto_id', it.produto_id)
          }

          // Movimentação de estoque: entrada
          await supabaseAdmin.from('movimentacoes_estoque').insert({
            empresa_id: DEMO_EMPRESA_ID,
            produto_id: it.produto_id,
            tipo: 'entrada',
            quantidade: it.qtd,
            motivo: `Compra #${c.numero}`,
            referencia_id: c.id,
            fornecedor_id: c.fornecedor_id,
            usuario_id: MASTER_USER_ID,
            created_at: createdAtStr,
          })
        }

        summary.compras_criadas++
      } else {
        summary.compras_existentes++
      }
    }

    // =========================================================================
    // 6. FINANCEIRO (Contas a Pagar + Contas a Receber)
    // =========================================================================
    // 6.1 Contas a Pagar: Compra 1 (a prazo)
    const compra1ItensTotal = COMPRAS_CONFIG[0].itens.reduce(
      (acc, it) => acc + it.qtd * it.preco_unitario,
      0,
    )
    const { data: existingCp } = await supabaseAdmin
      .from('contas_pagar')
      .select('id')
      .eq('empresa_id', DEMO_EMPRESA_ID)
      .eq('descricao', 'Compra #3001 — Coca-Cola Distribuidora')
      .maybeSingle()

    if (!existingCp) {
      const { error: insCpErr } = await supabaseAdmin.from('contas_pagar').insert({
        empresa_id: DEMO_EMPRESA_ID,
        fornecedor_id: FORNECEDOR_1,
        descricao: 'Compra #3001 — Coca-Cola Distribuidora',
        valor: Number(compra1ItensTotal.toFixed(2)),
        vencimento: getDateDaysFromNow(15),
        status: 'pendente',
        valor_pago: 0,
      })

      if (insCpErr) {
        console.warn(`Aviso ao criar conta a pagar: ${insCpErr.message}`)
      } else {
        summary.contas_pagar_criadas++
      }
    }

    // 6.2 Contas a Receber: Venda 3 e Venda 8 (crédito)
    const crVendas = [
      {
        venda_id: 'ddddddd3-0000-0000-0000-000000000003',
        cliente_id: 'd0000003-0000-0000-0000-000000000003',
        numero: 1003,
        vencimento: getDateDaysFromNow(10),
      },
      {
        venda_id: 'ddddddd3-0000-0000-0000-000000000008',
        cliente_id: 'd0000003-0000-0000-0000-000000000004',
        numero: 1008,
        vencimento: getDateDaysFromNow(20),
      },
    ]

    for (const cr of crVendas) {
      const { data: existingCr } = await supabaseAdmin
        .from('contas_receber')
        .select('id')
        .eq('empresa_id', DEMO_EMPRESA_ID)
        .eq('venda_id', cr.venda_id)
        .maybeSingle()

      if (!existingCr) {
        // Obter valor da venda
        const { data: vDb } = await supabaseAdmin
          .from('vendas')
          .select('total, cliente_id')
          .eq('id', cr.venda_id)
          .maybeSingle()

        if (vDb) {
          const { error: insCrErr } = await supabaseAdmin.from('contas_receber').insert({
            empresa_id: DEMO_EMPRESA_ID,
            venda_id: cr.venda_id,
            cliente_id: cr.cliente_id,
            descricao: `Venda #${cr.numero}`,
            valor: Number(vDb.total),
            vencimento: cr.vencimento,
            status: 'pendente',
            valor_pago: 0,
          })

          if (insCrErr) {
            console.warn(
              `Aviso ao criar conta a receber da venda #${cr.numero}: ${insCrErr.message}`,
            )
          } else {
            summary.contas_receber_criadas++
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        mensagem: 'Seed do ambiente Demo executado com sucesso!',
        summary,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  } catch (error: any) {
    console.error('seed-demo: Erro fatal', error)
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error?.message || 'Erro inesperado durante a execução do seed.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }
})
