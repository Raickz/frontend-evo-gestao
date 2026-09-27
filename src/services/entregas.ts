import { supabase } from '@/lib/supabase/client'

export interface Veiculo {
  id: string
  empresa_id: string
  identificacao: string
  placa: string
  modelo?: string | null
  capacidade_cestas: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Rota {
  id: string
  empresa_id: string
  numero: number
  data: string
  veiculo_id: string
  responsavel_usuario_id: string
  status: 'aberta' | 'em_andamento' | 'finalizada'
  horario_saida?: string | null
  horario_fechamento?: string | null
  observacoes?: string | null
  divergencia_fechamento?: any
  created_by?: string | null
  created_at: string
  updated_at: string
  veiculos?: Veiculo
  usuarios?: { id: string; nome: string; email: string; perfil: string }
}

export interface RotaItemEstoque {
  id: string
  empresa_id: string
  rota_id: string
  produto_id: string
  quantidade_carregada: number
  quantidade_vendida: number
  quantidade_entregue: number
  quantidade_devolvida: number
  created_at: string
  updated_at: string
  produtos?: { id: string; nome: string; preco_venda: number; unidade?: string }
}

export interface RotaPedido {
  id: string
  empresa_id: string
  rota_id: string
  pedido_id: string
  ordem_entrega: number
  status_entrega: 'pendente' | 'entregue' | 'nao_entregue'
  motivo_nao_entrega?: string | null
  venda_id?: string | null
  horario_conclusao?: string | null
  created_at: string
  updated_at: string
  pedidos?: {
    id: string
    numero: number
    total: number
    status: string
    observacoes?: string | null
    cliente_id?: string | null
    clientes?: {
      id: string
      nome: string
      telefone?: string | null
      endereco?: string | null
      bairro?: string | null
      cidade?: string | null
      numero?: string | null
    }
    itens_pedido?: Array<{
      id: string
      produto_id: string
      quantidade: number
      preco_unitario: number
      produtos?: { nome: string }
    }>
  }
}

export const EntregasService = {
  // --- VEÍCULOS ---
  async listarVeiculos(empresaId: string) {
    return supabase
      .from('veiculos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('identificacao', { ascending: true })
  },

  async criarVeiculo(dados: {
    empresa_id: string
    identificacao: string
    placa: string
    modelo?: string
    capacidade_cestas: number
  }) {
    return supabase.from('veiculos').insert(dados).select().single()
  },

  async atualizarVeiculo(
    id: string,
    empresaId: string,
    dados: {
      identificacao?: string
      placa?: string
      modelo?: string
      capacidade_cestas?: number
      ativo?: boolean
    },
  ) {
    return supabase
      .from('veiculos')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()
  },

  // --- ROTAS ---
  async listarRotas(empresaId: string, options?: { data?: string; status?: string }) {
    let query = supabase
      .from('rotas')
      .select('*, veiculos(*), usuarios:responsavel_usuario_id(id, nome, email, perfil)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })

    if (options?.data) {
      query = query.eq('data', options.data)
    }
    if (options?.status) {
      query = query.eq('status', options.status)
    }

    return query
  },

  async obterRota(rotaId: string, empresaId: string) {
    return supabase
      .from('rotas')
      .select('*, veiculos(*), usuarios:responsavel_usuario_id(id, nome, email, perfil)')
      .eq('id', rotaId)
      .eq('empresa_id', empresaId)
      .single()
  },

  async obterMinhaRotaAtiva(usuarioId: string, empresaId: string) {
    return supabase
      .from('rotas')
      .select('*, veiculos(*), usuarios:responsavel_usuario_id(id, nome, email, perfil)')
      .eq('empresa_id', empresaId)
      .eq('responsavel_usuario_id', usuarioId)
      .eq('status', 'em_andamento')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  },

  async criarRota(dados: {
    empresa_id: string
    veiculo_id: string
    responsavel_usuario_id: string
    data?: string
    observacoes?: string
    created_by?: string
  }) {
    // Buscar próximo número
    const { data: maxRota } = await supabase
      .from('rotas')
      .select('numero')
      .eq('empresa_id', dados.empresa_id)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()

    const proximoNumero = (maxRota?.numero || 0) + 1

    return supabase
      .from('rotas')
      .insert({
        empresa_id: dados.empresa_id,
        numero: proximoNumero,
        veiculo_id: dados.veiculo_id,
        responsavel_usuario_id: dados.responsavel_usuario_id,
        data: dados.data || new Date().toISOString().split('T')[0],
        status: 'aberta',
        observacoes: dados.observacoes || null,
        created_by: dados.created_by || null,
      })
      .select('*, veiculos(*), usuarios:responsavel_usuario_id(id, nome, email, perfil)')
      .single()
  },

  async listarItensEstoqueRota(rotaId: string) {
    return supabase
      .from('rota_itens_estoque')
      .select('*, produtos(id, nome, preco_venda, unidade)')
      .eq('rota_id', rotaId)
  },

  async listarPedidosRota(rotaId: string) {
    return supabase
      .from('rota_pedidos')
      .select(
        '*, pedidos(id, numero, total, status, observacoes, cliente_id, clientes(id, nome, telefone, endereco, numero, bairro, cidade), itens_pedido(id, produto_id, quantidade, preco_unitario, produtos(nome)))',
      )
      .eq('rota_id', rotaId)
      .order('ordem_entrega', { ascending: true })
  },

  // --- RPCS SEGURAS ---
  async carregarVeiculoRota(params: {
    rotaId: string
    itens?: Array<{ produto_id: string; quantidade: number }>
    pedidoIds?: string[]
  }) {
    return (supabase.rpc as any)('carregar_veiculo_rota', {
      p_rota_id: params.rotaId,
      p_itens: params.itens || [],
      p_pedido_ids: params.pedidoIds || [],
    })
  },

  async venderNaRua(params: {
    rotaId: string
    clienteId?: string | null
    itens: Array<{ produto_id: string; quantidade: number }>
    formaPagamento?: string
    condicao?: 'a_vista' | 'parcelado'
    pagamentos?: Array<{ forma: string; valor: number; data?: string; referencia?: string }> | null
    entradaValor?: number
    entradaForma?: string
    numParcelas?: number
    intervaloDias?: number
    observacoes?: string | null
  }) {
    return (supabase.rpc as any)('vender_na_rua', {
      p_rota_id: params.rotaId,
      p_cliente_id: params.clienteId || null,
      p_itens: params.itens,
      p_forma_pagamento: params.formaPagamento || 'pix',
      p_condicao: params.condicao || 'a_vista',
      p_pagamentos: params.pagamentos || null,
      p_entrada_valor: params.entradaValor || 0,
      p_entrada_forma: params.entradaForma || 'dinheiro',
      p_num_parcelas: params.numParcelas || 1,
      p_intervalo_dias: params.intervaloDias || 30,
      p_observacoes: params.observacoes || null,
    })
  },

  async concluirEntregaPedidoRota(params: {
    rotaId: string
    pedidoId: string
    entregue: boolean
    motivoNaoEntrega?: string | null
    pagamentos?: Array<{ forma: string; valor: number; data?: string; referencia?: string }> | null
    formaPagamento?: string
  }) {
    return (supabase.rpc as any)('concluir_entrega_pedido_rota', {
      p_rota_id: params.rotaId,
      p_pedido_id: params.pedidoId,
      p_entregue: params.entregue,
      p_motivo_nao_entrega: params.motivoNaoEntrega || null,
      p_pagamentos: params.pagamentos || null,
      p_forma_pagamento: params.formaPagamento || 'dinheiro',
    })
  },

  async fecharRotaAcerto(params: {
    rotaId: string
    conferencia?: Array<{ produto_id: string; quantidade: number }>
    observacoes?: string | null
  }) {
    return (supabase.rpc as any)('fechar_rota_acerto', {
      p_rota_id: params.rotaId,
      p_conferencia: params.conferencia || [],
      p_observacoes: params.observacoes || null,
    })
  },
}
