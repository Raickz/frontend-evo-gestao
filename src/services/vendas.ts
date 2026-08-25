import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export type Venda = Tables<'vendas'>
export type ItemVenda = Tables<'itens_venda'>

export interface FinalizarVendaPayloadItem {
  produto_id: string
  quantidade: number
}

export interface ListVendasFilters {
  search?: string
  status?: string
  formaPagamento?: string
  dataInicio?: string
  dataFim?: string
  pagina?: number
  limite?: number
}

export const VendasService = {
  async list(empresaId: string) {
    return supabase
      .from('vendas')
      .select('*, clientes(nome, documento), vendedores(nome), usuarios(nome)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
  },

  async listFiltered(empresaId: string, options: ListVendasFilters = {}) {
    const { search, status, formaPagamento, dataInicio, dataFim, pagina = 1, limite = 20 } = options

    let query = supabase
      .from('vendas')
      .select('*, clientes(nome, documento), vendedores(nome)')
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (formaPagamento && formaPagamento !== 'todas') {
      query = query.eq('forma_pagamento', formaPagamento)
    }

    if (dataInicio) {
      // Começo do dia
      query = query.gte('created_at', new Date(`${dataInicio}T00:00:00`).toISOString())
    }

    if (dataFim) {
      // Fim do dia
      query = query.lte('created_at', new Date(`${dataFim}T23:59:59.999`).toISOString())
    }

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      const isNumeric = /^\d+$/.test(cleanTerm)
      if (isNumeric) {
        query = query.or(`numero.eq.${cleanTerm},observacoes.ilike.%${cleanTerm}%`)
      } else {
        // PostgREST filter on nested relation clientes.nome via !inner or client-side/search on observacoes or matching cliente
        // In supabase postgrest, filters on root table or or queries with relations can use foreign tables or subquery
        // But simpler: we search observacoes or if text matches
        query = query.or(`observacoes.ilike.%${cleanTerm}%`)
      }
    }

    const from = (pagina - 1) * limite
    const to = from + limite - 1

    return query.order('created_at', { ascending: false }).range(from, to)
  },

  async countFiltered(empresaId: string, options: ListVendasFilters = {}) {
    const { search, status, formaPagamento, dataInicio, dataFim } = options

    let query = supabase
      .from('vendas')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (formaPagamento && formaPagamento !== 'todas') {
      query = query.eq('forma_pagamento', formaPagamento)
    }

    if (dataInicio) {
      query = query.gte('created_at', new Date(`${dataInicio}T00:00:00`).toISOString())
    }

    if (dataFim) {
      query = query.lte('created_at', new Date(`${dataFim}T23:59:59.999`).toISOString())
    }

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      const isNumeric = /^\d+$/.test(cleanTerm)
      if (isNumeric) {
        query = query.or(`numero.eq.${cleanTerm},observacoes.ilike.%${cleanTerm}%`)
      } else {
        query = query.or(`observacoes.ilike.%${cleanTerm}%`)
      }
    }

    return query
  },

  async listClientesAtivos(empresaId: string, search?: string) {
    let query = supabase
      .from('clientes')
      .select('id, nome, documento, limite_credito, telefone, email')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      query = query.or(`nome.ilike.%${cleanTerm}%,documento.ilike.%${cleanTerm}%`)
    }

    return query.order('nome', { ascending: true })
  },

  async listVendedoresAtivos(empresaId: string, search?: string) {
    let query = supabase
      .from('vendedores')
      .select('id, nome, percentual_comissao, usuario_id')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      query = query.ilike('nome', `%${cleanTerm}%`)
    }

    return query.order('nome', { ascending: true })
  },

  async listProdutosDisponiveis(empresaId: string, search?: string) {
    let query = supabase
      .from('produtos')
      .select(
        'id, nome, codigo, codigo_barras, preco_venda, preco_custo, unidade, estoque_minimo, foto_url, estoques(quantidade)',
      )
      .eq('empresa_id', empresaId)
      .eq('ativo', true)

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      query = query.or(
        `nome.ilike.%${cleanTerm}%,codigo.ilike.%${cleanTerm}%,codigo_barras.ilike.%${cleanTerm}%`,
      )
    }

    return query.order('nome', { ascending: true })
  },

  async getFaturamentoMensal(empresaId: string) {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    return supabase
      .from('vendas')
      .select('total')
      .eq('empresa_id', empresaId)
      .eq('status', 'finalizada')
      .gte('created_at', inicioMes.toISOString())
  },

  async getCountMensal(empresaId: string) {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    return supabase
      .from('vendas')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'finalizada')
      .gte('created_at', inicioMes.toISOString())
  },

  async getRecentes(empresaId: string) {
    return supabase
      .from('vendas')
      .select('id, numero, total, forma_pagamento, status, created_at, clientes(nome)')
      .eq('empresa_id', empresaId)
      .eq('status', 'finalizada')
      .order('created_at', { ascending: false })
      .limit(5)
  },

  async getById(empresaId: string, id: string) {
    return supabase
      .from('vendas')
      .select('*, clientes(*), vendedores(*), itens_venda(*, produtos(*))')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  async finalizarVendaViaRpc(params: {
    clienteId?: string | null
    vendedorId?: string | null
    itens: FinalizarVendaPayloadItem[]
    desconto?: number
    formaPagamento?: string
    vencimento?: string | null
    observacoes?: string | null
  }) {
    return supabase.rpc('finalizar_venda', {
      p_cliente_id: params.clienteId as string,
      p_vendedor_id: params.vendedorId as string,
      p_itens: params.itens as any,
      p_desconto: params.desconto || 0,
      p_forma_pagamento: params.formaPagamento || 'pix',
      p_vencimento: params.vencimento || undefined,
      p_observacoes: params.observacoes || undefined,
    })
  },
}
