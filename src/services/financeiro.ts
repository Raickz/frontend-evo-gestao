import { supabase } from '@/lib/supabase/client'
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
    empresaId: string,
    data: Omit<TablesInsert<'contas_receber'>, 'empresa_id'>,
  ) {
    return supabase
      .from('contas_receber')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async createContaPagar(
    empresaId: string,
    data: Omit<TablesInsert<'contas_pagar'>, 'empresa_id'>,
  ) {
    return supabase
      .from('contas_pagar')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async updateContaReceber(empresaId: string, id: string, data: TablesUpdate<'contas_receber'>) {
    return supabase
      .from('contas_receber')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  async updateContaPagar(empresaId: string, id: string, data: TablesUpdate<'contas_pagar'>) {
    return supabase
      .from('contas_pagar')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
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
      .select('*', { count: 'exact', head: true })
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

    const todayStr = new Date().toISOString().split('T')[0]

    let total = 0
    let recebido = 0
    let vencido = 0
    let aVencer = 0

    for (const item of data) {
      const valor = Number(item.valor) || 0
      const valorPago = Number(item.valor_pago) || 0
      const saldo = Math.max(0, valor - valorPago)
      const vencimento = item.vencimento ? item.vencimento.split('T')[0] : ''

      if (item.status !== 'cancelado') {
        total += valor
      }

      recebido += valorPago

      if (item.status === 'atrasado' || (item.status === 'pendente' && vencimento < todayStr)) {
        vencido += saldo
      } else if (item.status === 'pendente' && vencimento >= todayStr) {
        aVencer += saldo
      }
    }

    return {
      total,
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
      .select('*', { count: 'exact', head: true })
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

  async getIndicadoresPagar(empresaId: string): Promise<FinanceiroIndicadores> {
    const { data, error } = await supabase
      .from('contas_pagar')
      .select('status, valor, valor_pago, vencimento')
      .eq('empresa_id', empresaId)

    if (error || !data) {
      return { total: 0, recebidoOuPago: 0, vencido: 0, aVencer: 0 }
    }

    const todayStr = new Date().toISOString().split('T')[0]

    let total = 0
    let pago = 0
    let vencido = 0
    let aVencer = 0

    for (const item of data) {
      const valor = Number(item.valor) || 0
      const valorPago = Number(item.valor_pago) || 0
      const saldo = Math.max(0, valor - valorPago)
      const vencimento = item.vencimento ? item.vencimento.split('T')[0] : ''

      if (item.status !== 'cancelado') {
        total += valor
      }

      pago += valorPago

      if (item.status === 'atrasado' || (item.status === 'pendente' && vencimento < todayStr)) {
        vencido += saldo
      } else if (item.status === 'pendente' && vencimento >= todayStr) {
        aVencer += saldo
      }
    }

    return {
      total,
      recebidoOuPago: pago,
      vencido,
      aVencer,
    }
  },
}
