import { supabase } from '@/lib/supabase/client'
import { getHojeSaoPaulo, RegrasCalculo } from '@/services/regras-calculo'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type ContaReceber = Tables<'contas_receber'>
export type ContaPagar = Tables<'contas_pagar'>

export interface ContasReceberItem extends ContaReceber {
  clientes: { nome: string } | null
  vendas: { numero: number } | null
}

export interface ContasPagarItem extends ContaPagar {
  fornecedores: { nome: string } | null
}

export interface FinanceiroFilterOptions {
  search?: string
  status?: string
  dataInicio?: string
  dataFim?: string
  page?: number
  pageSize?: number
}

export interface FinanceiroIndicadores {
  total: number
  recebidoOuPago: number
  vencido: number
  aVencer: number
}

export interface BaixaRecebimentoResult {
  sucesso?: boolean
  conta_id?: string
  saldo_anterior?: number
  valor_recebido?: number
  valor_pago?: number
  saldo_restante?: number
  status?: string
  [key: string]: any
}

export interface BaixaPagamentoResult {
  sucesso?: boolean
  conta_id?: string
  saldo_anterior?: number
  valor_pago?: number
  total_pago?: number
  saldo_restante?: number
  status?: string
  [key: string]: any
}

export const FinanceiroService = {
  // Legacy / Basic methods
  async listContasReceber(empresaId: string) {
    return supabase
      .from('contas_receber')
      .select('*, clientes(nome), vendas(numero)')
      .eq('empresa_id', empresaId)
      .order('vencimento', { ascending: true })
  },

  async listContasPagar(empresaId: string) {
    return supabase
      .from('contas_pagar')
      .select('*, fornecedores(nome)')
      .eq('empresa_id', empresaId)
      .order('vencimento', { ascending: true })
  },

  async createContaReceber(
    _empresaId: string,
    data: Omit<TablesInsert<'contas_receber'>, 'empresa_id'>,
  ) {
    const { data: res, error } = await (supabase.rpc as any)('criar_titulo_receber', {
      p_descricao: data.descricao,
      p_valor: data.valor,
      p_vencimento: data.vencimento,
      p_cliente_id: data.cliente_id || null,
    })
    if (error) return { data: null, error }
    return { data: res, error: null }
  },

  async createContaPagar(
    _empresaId: string,
    data: Omit<TablesInsert<'contas_pagar'>, 'empresa_id'>,
  ) {
    const { data: res, error } = await (supabase.rpc as any)('criar_titulo_pagar', {
      p_descricao: data.descricao,
      p_valor: data.valor,
      p_vencimento: data.vencimento,
      p_fornecedor_id: data.fornecedor_id || null,
    })
    if (error) return { data: null, error }
    return { data: res, error: null }
  },

  async updateContaReceber(_empresaId: string, id: string, data: TablesUpdate<'contas_receber'>) {
    const { data: res, error } = await (supabase.rpc as any)('atualizar_titulo_receber', {
      p_id: id,
      p_descricao: data.descricao || '',
      p_valor: data.valor || 0,
      p_vencimento: data.vencimento || null,
      p_cliente_id: data.cliente_id || null,
    })
    if (error) return { data: null, error }
    return { data: res, error: null }
  },

  async updateContaPagar(_empresaId: string, id: string, data: TablesUpdate<'contas_pagar'>) {
    const { data: res, error } = await (supabase.rpc as any)('atualizar_titulo_pagar', {
      p_id: id,
      p_descricao: data.descricao || '',
      p_valor: data.valor || 0,
      p_vencimento: data.vencimento || null,
      p_fornecedor_id: data.fornecedor_id || null,
    })
    if (error) return { data: null, error }
    return { data: res, error: null }
  },

  async cancelarContaPagar(_empresaId: string, id: string) {
    return (supabase.rpc as any)('cancelar_titulo_pagar', { p_id: id })
  },

  async cancelarContaReceber(_empresaId: string, id: string) {
    return (supabase.rpc as any)('cancelar_titulo_receber', { p_id: id })
  },

  // Contas a Receber Filtradas e Paginadas
  async listContasReceberFiltered(empresaId: string, options: FinanceiroFilterOptions = {}) {
    const { search, status, dataInicio, dataFim, page = 1, pageSize = 20 } = options

    let matchedClienteIds: string[] | null = null
    if (search && search.trim()) {
      const { data: matchedClientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('nome', `%${search.trim()}%`)

      matchedClienteIds = (matchedClientes || []).map((c) => c.id)
    }

    let query = supabase
      .from('contas_receber')
      .select('*, clientes(nome), vendas(numero)')
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('vencimento', dataInicio)
    }

    if (dataFim) {
      query = query.lte('vencimento', dataFim)
    }

    if (search && search.trim()) {
      const term = search.trim()
      if (matchedClienteIds && matchedClienteIds.length > 0) {
        query = query.or(`descricao.ilike.%${term}%,cliente_id.in.(${matchedClienteIds.join(',')})`)
      } else {
        query = query.ilike('descricao', `%${term}%`)
      }
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    return query.order('vencimento', { ascending: true }).range(from, to)
  },

  async countContasReceberFiltered(empresaId: string, options: FinanceiroFilterOptions = {}) {
    const { search, status, dataInicio, dataFim } = options

    let matchedClienteIds: string[] | null = null
    if (search && search.trim()) {
      const { data: matchedClientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('nome', `%${search.trim()}%`)

      matchedClienteIds = (matchedClientes || []).map((c) => c.id)
    }

    let query = supabase
      .from('contas_receber')
      .select('id', { count: 'exact' })
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('vencimento', dataInicio)
    }

    if (dataFim) {
      query = query.lte('vencimento', dataFim)
    }

    if (search && search.trim()) {
      const term = search.trim()
      if (matchedClienteIds && matchedClienteIds.length > 0) {
        query = query.or(`descricao.ilike.%${term}%,cliente_id.in.(${matchedClienteIds.join(',')})`)
      } else {
        query = query.ilike('descricao', `%${term}%`)
      }
    }

    return query
  },

  async getIndicadoresReceber(empresaId: string): Promise<FinanceiroIndicadores> {
    const { data, error } = await supabase
      .from('contas_receber')
      .select('status, valor, valor_pago, vencimento')
      .eq('empresa_id', empresaId)

    if (error || !data) {
      return { total: 0, recebidoOuPago: 0, vencido: 0, aVencer: 0 }
    }

    const todayStr = getHojeSaoPaulo()

    let totalSaldoAberto = 0
    let recebido = 0
    let vencido = 0
    let aVencer = 0

    for (const item of data) {
      const valor = Number(item.valor) || 0
      const valorPago = Number(item.valor_pago) || 0
      const saldo = RegrasCalculo.saldoEmAberto(valor, valorPago)
      const vencimento = item.vencimento ? item.vencimento.split('T')[0] : ''

      if (item.status !== 'cancelado') {
        totalSaldoAberto += saldo
      }

      recebido += valorPago

      if (item.status !== 'cancelado') {
        if (item.status === 'atrasado' || (item.status === 'pendente' && vencimento < todayStr)) {
          vencido += saldo
        } else if (item.status === 'pendente' && vencimento >= todayStr) {
          aVencer += saldo
        }
      }
    }

    return {
      total: totalSaldoAberto,
      recebidoOuPago: recebido,
      vencido,
      aVencer,
    }
  },

  // Contas a Pagar Filtradas e Paginadas
  async listContasPagarFiltered(empresaId: string, options: FinanceiroFilterOptions = {}) {
    const { search, status, dataInicio, dataFim, page = 1, pageSize = 20 } = options

    let matchedFornecedorIds: string[] | null = null
    if (search && search.trim()) {
      const { data: matchedFornecedores } = await supabase
        .from('fornecedores')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('nome', `%${search.trim()}%`)

      matchedFornecedorIds = (matchedFornecedores || []).map((f) => f.id)
    }

    let query = supabase
      .from('contas_pagar')
      .select('*, fornecedores(nome)')
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('vencimento', dataInicio)
    }

    if (dataFim) {
      query = query.lte('vencimento', dataFim)
    }

    if (search && search.trim()) {
      const term = search.trim()
      if (matchedFornecedorIds && matchedFornecedorIds.length > 0) {
        query = query.or(
          `descricao.ilike.%${term}%,fornecedor_id.in.(${matchedFornecedorIds.join(',')})`,
        )
      } else {
        query = query.ilike('descricao', `%${term}%`)
      }
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    return query.order('vencimento', { ascending: true }).range(from, to)
  },

  async countContasPagarFiltered(empresaId: string, options: FinanceiroFilterOptions = {}) {
    const { search, status, dataInicio, dataFim } = options

    let matchedFornecedorIds: string[] | null = null
    if (search && search.trim()) {
      const { data: matchedFornecedores } = await supabase
        .from('fornecedores')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('nome', `%${search.trim()}%`)

      matchedFornecedorIds = (matchedFornecedores || []).map((f) => f.id)
    }

    let query = supabase
      .from('contas_pagar')
      .select('id', { count: 'exact' })
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('vencimento', dataInicio)
    }

    if (dataFim) {
      query = query.lte('vencimento', dataFim)
    }

    if (search && search.trim()) {
      const term = search.trim()
      if (matchedFornecedorIds && matchedFornecedorIds.length > 0) {
        query = query.or(
          `descricao.ilike.%${term}%,fornecedor_id.in.(${matchedFornecedorIds.join(',')})`,
        )
      } else {
        query = query.ilike('descricao', `%${term}%`)
      }
    }

    return query
  },

  async registrarRecebimento(
    _empresaId: string,
    contaId: string,
    valorRecebido: number,
    dataPagamento?: string,
  ) {
    return supabase.rpc('registrar_recebimento', {
      p_conta_id: contaId,
      p_valor_recebido: valorRecebido,
      p_data_pagamento: dataPagamento || undefined,
    })
  },

  async registrarPagamento(
    _empresaId: string,
    contaId: string,
    valorPago: number,
    dataPagamento?: string,
  ) {
    return supabase.rpc('registrar_pagamento', {
      p_conta_id: contaId,
      p_valor_pago: valorPago,
      p_data_pagamento: dataPagamento || undefined,
    })
  },

  async getIndicadoresPagar(empresaId: string): Promise<FinanceiroIndicadores> {
    const { data, error } = await supabase
      .from('contas_pagar')
      .select('status, valor, valor_pago, vencimento')
      .eq('empresa_id', empresaId)

    if (error || !data) {
      return { total: 0, recebidoOuPago: 0, vencido: 0, aVencer: 0 }
    }

    const todayStr = getHojeSaoPaulo()

    let totalSaldoAberto = 0
    let pago = 0
    let vencido = 0
    let aVencer = 0

    for (const item of data) {
      const valor = Number(item.valor) || 0
      const valorPago = Number(item.valor_pago) || 0
      const saldo = RegrasCalculo.saldoEmAberto(valor, valorPago)
      const vencimento = item.vencimento ? item.vencimento.split('T')[0] : ''

      if (item.status !== 'cancelado') {
        totalSaldoAberto += saldo
      }

      pago += valorPago

      if (item.status !== 'cancelado') {
        if (item.status === 'atrasado' || (item.status === 'pendente' && vencimento < todayStr)) {
          vencido += saldo
        } else if (item.status === 'pendente' && vencimento >= todayStr) {
          aVencer += saldo
        }
      }
    }

    return {
      total: totalSaldoAberto,
      recebidoOuPago: pago,
      vencido,
      aVencer,
    }
  },
}
