import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export type ComissaoRow = Tables<'comissoes'>

export type Comissao = ComissaoRow & {
  vendedores?: {
    id?: string
    nome: string
  } | null
  vendas?: {
    id?: string
    numero: number
    total: number
  } | null
}

export interface ComissoesFilterOptions {
  termo?: string
  status?: string // 'pendente' | 'pago' | 'cancelado' | 'todos'
  vendedorId?: string // uuid ou 'todos'
  dataInicio?: string // YYYY-MM-DD
  dataFim?: string // YYYY-MM-DD
  page?: number
  pageSize?: number
}

export interface IndicadoresComissoes {
  totalComissoes: number
  comissoesPendentes: number
  comissoesPagas: number
  totalVendasComissionadas: number
}

export const ComissoesService = {
  /**
   * Lista comissões paginadas (20/pág padrão) com joins em vendedores e vendas.
   * Filtros opcionais: busca textual em vendedores, status, vendedor_id, período (created_at).
   * Ordenado por created_at DESC.
   *
   * IMPORTANTE: SOMENTE CONSULTA (SELECT).
   */
  async listFiltered(empresaId: string, options: ComissoesFilterOptions = {}) {
    const page = Math.max(1, options.page || 1)
    const pageSize = options.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('comissoes')
      .select('*, vendedores!inner(id, nome), vendas(id, numero, total)', { count: 'exact' })
      .eq('empresa_id', empresaId)

    // Filtro por termo (nome do vendedor)
    if (options.termo && options.termo.trim()) {
      query = query.ilike('vendedores.nome', `%${options.termo.trim()}%`)
    }

    // Filtro por status
    if (options.status && options.status !== 'todos') {
      query = query.eq('status', options.status)
    }

    // Filtro por vendedor_id
    if (options.vendedorId && options.vendedorId !== 'todos') {
      query = query.eq('vendedor_id', options.vendedorId)
    }

    // Filtro por período
    if (options.dataInicio) {
      // Início do dia
      query = query.gte('created_at', `${options.dataInicio}T00:00:00`)
    }
    if (options.dataFim) {
      // Final do dia
      query = query.lte('created_at', `${options.dataFim}T23:59:59.999Z`)
    }

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, count, error } = await query

    return {
      data: (data as unknown as Comissao[]) || [],
      count: count || 0,
      error,
    }
  },

  /**
   * Contagem de registros com os mesmos filtros (head: true, count: exact)
   */
  async countFiltered(empresaId: string, options: ComissoesFilterOptions = {}) {
    let query = supabase
      .from('comissoes')
      .select('id, vendedores!inner(id, nome)', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)

    if (options.termo && options.termo.trim()) {
      query = query.ilike('vendedores.nome', `%${options.termo.trim()}%`)
    }

    if (options.status && options.status !== 'todos') {
      query = query.eq('status', options.status)
    }

    if (options.vendedorId && options.vendedorId !== 'todos') {
      query = query.eq('vendedor_id', options.vendedorId)
    }

    if (options.dataInicio) {
      query = query.gte('created_at', `${options.dataInicio}T00:00:00`)
    }
    if (options.dataFim) {
      query = query.lte('created_at', `${options.dataFim}T23:59:59.999Z`)
    }

    const { count, error } = await query
    return { count: count || 0, error }
  },

  /**
   * Calcula os 4 indicadores agregados da empresa:
   * 1. Total de comissões (soma de valor_comissao de registros não cancelados)
   * 2. Comissões pendentes (soma de valor_comissao onde status = 'pendente')
   * 3. Comissões pagas (soma de valor_comissao onde status = 'pago')
   * 4. Total de vendas comissionadas (count de todos os registros de comissões)
   */
  async getIndicadores(empresaId: string): Promise<{ data: IndicadoresComissoes; error: any }> {
    const { data, error } = await supabase
      .from('comissoes')
      .select('valor_comissao, status')
      .eq('empresa_id', empresaId)

    if (error) {
      return {
        data: {
          totalComissoes: 0,
          comissoesPendentes: 0,
          comissoesPagas: 0,
          totalVendasComissionadas: 0,
        },
        error,
      }
    }

    let totalComissoes = 0
    let comissoesPendentes = 0
    let comissoesPagas = 0
    const totalVendasComissionadas = data ? data.length : 0

    if (data) {
      for (const item of data) {
        const valor = Number(item.valor_comissao) || 0
        if (item.status !== 'cancelado') {
          totalComissoes += valor
        }
        if (item.status === 'pendente') {
          comissoesPendentes += valor
        } else if (item.status === 'pago') {
          comissoesPagas += valor
        }
      }
    }

    return {
      data: {
        totalComissoes,
        comissoesPendentes,
        comissoesPagas,
        totalVendasComissionadas,
      },
      error: null,
    }
  },

  /**
   * Lista vendedores ativos para popular o dropdown de filtro
   */
  async listVendedores(empresaId: string) {
    return supabase
      .from('vendedores')
      .select('id, nome, ativo')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome', { ascending: true })
  },
}
