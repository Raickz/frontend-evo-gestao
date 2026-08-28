import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/lib/supabase/types'

export type Estoque = Tables<'estoques'>
export type MovimentacaoEstoque = Tables<'movimentacoes_estoque'>

export interface EstoqueIndicadores {
  total: number
  zerados: number
  abaixoMinimo: number
  normal: number
}

export interface ListSaldosOptions {
  search?: string
  statusFilter?: 'todos' | 'zerados' | 'abaixo_minimo' | 'normal'
  page?: number
  pageSize?: number
}

export interface ListMovimentacoesOptions {
  search?: string
  tipo?: 'todos' | 'entrada' | 'saida'
  fornecedorId?: string
  dataInicio?: string
  dataFim?: string
  page?: number
  pageSize?: number
}

export interface ProdutoSaldoItem {
  id: string
  empresa_id: string
  produto_id: string
  quantidade: number
  updated_at: string
  produtos: {
    id: string
    nome: string
    codigo: string | null
    estoque_minimo: number
    unidade: string
    ativo: boolean
    categorias: {
      nome: string
    } | null
  } | null
}

export interface ProdutoParaEntrada {
  id: string
  nome: string
  codigo: string | null
  unidade: string
  estoque_minimo: number
  preco_custo: number
  saldoAtual: number
}

export interface FornecedorAtivoItem {
  id: string
  nome: string
}

export const EstoqueService = {
  async listSaldos(empresaId: string) {
    return supabase
      .from('estoques')
      .select('*, produtos(*, categorias(nome))')
      .eq('empresa_id', empresaId)
  },

  async listEstoqueBaixo(empresaId: string) {
    const res = await supabase
      .from('estoques')
      .select('quantidade, produtos!inner(nome, estoque_minimo, unidade, ativo)')
      .eq('empresa_id', empresaId)
      .eq('produtos.ativo', true)

    if (res.error) {
      return { data: null, error: res.error }
    }

    const filtered = (res.data || [])
      .filter((item: any) => {
        const prod = item.produtos
        const estoqueMin = prod?.estoque_minimo ?? 0
        const qtd = item.quantidade ?? 0
        return qtd <= estoqueMin
      })
      .slice(0, 10)

    return { data: filtered, error: null }
  },

  async listMovimentacoes(empresaId: string) {
    return supabase
      .from('movimentacoes_estoque')
      .select('*, produtos(nome, codigo), usuarios(nome), fornecedores(nome)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(100)
  },

  async registrarEntrada(
    produtoId: string,
    quantidade: number,
    motivo: string = 'Entrada de estoque',
  ) {
    return supabase.rpc('registrar_entrada_estoque', {
      p_produto_id: produtoId,
      p_quantidade: quantidade,
      p_motivo: motivo,
    })
  },

  async registrarEntradaPorFornecedor(
    fornecedorId: string,
    produtoId: string,
    quantidade: number,
    precoCusto: number,
    motivo: string = 'Entrada de estoque',
  ) {
    return (supabase.rpc as any)('registrar_entrada_estoque_por_fornecedor', {
      p_fornecedor_id: fornecedorId,
      p_produto_id: produtoId,
      p_quantidade: quantidade,
      p_preco_custo: precoCusto,
      p_motivo: motivo,
    })
  },

  async listFornecedoresAtivosParaEntrada(empresaId: string) {
    return supabase
      .from('fornecedores')
      .select('id, nome')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome', { ascending: true })
  },

  async registrarMovimentacaoManual(
    empresaId: string,
    data: Omit<TablesInsert<'movimentacoes_estoque'>, 'empresa_id'>,
  ) {
    return supabase
      .from('movimentacoes_estoque')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  /**
   * Retorna os indicadores resumidos de estoque:
   * total (produtos com registro ativo em estoques),
   * zerados (quantidade === 0),
   * abaixoMinimo (quantidade > 0 && quantidade <= estoque_minimo),
   * normal (quantidade > estoque_minimo)
   */
  async getIndicadores(
    empresaId: string,
  ): Promise<{ data: EstoqueIndicadores | null; error: any }> {
    const { data, error } = await supabase
      .from('estoques')
      .select('quantidade, produtos!inner(estoque_minimo, ativo)')
      .eq('empresa_id', empresaId)
      .eq('produtos.ativo', true)

    if (error) {
      return { data: null, error }
    }

    let zerados = 0
    let abaixoMinimo = 0
    let normal = 0

    const total = data?.length || 0

    for (const item of data || []) {
      const qtd = Number(item.quantidade) || 0
      const prod = item.produtos as { estoque_minimo: number; ativo: boolean } | null
      const min = Number(prod?.estoque_minimo) || 0

      if (qtd === 0) {
        zerados++
      } else if (qtd > 0 && qtd <= min) {
        abaixoMinimo++
      } else if (qtd > min) {
        normal++
      }
    }

    return {
      data: {
        total,
        zerados,
        abaixoMinimo,
        normal,
      },
      error: null,
    }
  },

  /**
   * Busca saldos paginados com filtros.
   * Se o statusFilter for JS-based ('abaixo_minimo', 'normal'),
   * busca os registros filtrados por search no DB e aplica paginação e filtro em memória.
   * Se for 'zerados' ou 'todos', aplica no DB com range.
   */
  async listSaldosFiltered(
    empresaId: string,
    options: ListSaldosOptions = {},
  ): Promise<{ data: ProdutoSaldoItem[] | null; totalCount: number; error: any }> {
    const { search, statusFilter = 'todos', page = 1, pageSize = 20 } = options

    let query = supabase
      .from('estoques')
      .select(
        'id, empresa_id, produto_id, quantidade, updated_at, produtos!inner(id, nome, codigo, estoque_minimo, unidade, ativo, categorias(nome))',
        { count: 'exact' },
      )
      .eq('empresa_id', empresaId)
      .eq('produtos.ativo', true)

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`, { foreignTable: 'produtos' })
    }

    if (statusFilter === 'zerados') {
      query = query.eq('quantidade', 0)
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, count, error } = await query
        .order('nome', { foreignTable: 'produtos', ascending: true })
        .range(from, to)

      return {
        data: (data as unknown as ProdutoSaldoItem[]) || [],
        totalCount: count || 0,
        error,
      }
    }

    if (statusFilter === 'abaixo_minimo' || statusFilter === 'normal') {
      // Para filtros dependentes da relação quantidade x estoque_minimo
      const { data, error } = await query.order('nome', {
        foreignTable: 'produtos',
        ascending: true,
      })

      if (error) {
        return { data: null, totalCount: 0, error }
      }

      const allItems = (data as unknown as ProdutoSaldoItem[]) || []
      const filtered = allItems.filter((item) => {
        const qtd = Number(item.quantidade) || 0
        const min = Number(item.produtos?.estoque_minimo) || 0
        if (statusFilter === 'abaixo_minimo') {
          return qtd > 0 && qtd <= min
        }
        if (statusFilter === 'normal') {
          return qtd > min
        }
        return true
      })

      const totalCount = filtered.length
      const from = (page - 1) * pageSize
      const paginated = filtered.slice(from, from + pageSize)

      return {
        data: paginated,
        totalCount,
        error: null,
      }
    }

    // statusFilter === 'todos'
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query
      .order('nome', { foreignTable: 'produtos', ascending: true })
      .range(from, to)

    return {
      data: (data as unknown as ProdutoSaldoItem[]) || [],
      totalCount: count || 0,
      error,
    }
  },

  /**
   * Conta total de saldos de acordo com os filtros.
   */
  async countSaldosFiltered(
    empresaId: string,
    options: Omit<ListSaldosOptions, 'page' | 'pageSize'> = {},
  ): Promise<{ count: number; error: any }> {
    const { search, statusFilter = 'todos' } = options

    let query = supabase
      .from('estoques')
      .select('quantidade, produtos!inner(nome, codigo, estoque_minimo, ativo)', {
        count: 'exact',
      })
      .eq('empresa_id', empresaId)
      .eq('produtos.ativo', true)

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`, { foreignTable: 'produtos' })
    }

    if (statusFilter === 'zerados') {
      query = query.eq('quantidade', 0)
      const { count, error } = await query
      return { count: count || 0, error }
    }

    if (statusFilter === 'abaixo_minimo' || statusFilter === 'normal') {
      const { data, error } = await query
      if (error) {
        return { count: 0, error }
      }

      let count = 0
      for (const item of data || []) {
        const qtd = Number(item.quantidade) || 0
        const prod = item.produtos as { estoque_minimo: number } | null
        const min = Number(prod?.estoque_minimo) || 0
        if (statusFilter === 'abaixo_minimo' && qtd > 0 && qtd <= min) {
          count++
        } else if (statusFilter === 'normal' && qtd > min) {
          count++
        }
      }

      return { count, error: null }
    }

    const { count, error } = await query
    return { count: count || 0, error }
  },

  /**
   * Busca histórico de movimentações com paginação e filtros.
   */
  async listMovimentacoesFiltered(empresaId: string, options: ListMovimentacoesOptions = {}) {
    const { search, tipo, fornecedorId, dataInicio, dataFim, page = 1, pageSize = 20 } = options

    let query = supabase
      .from('movimentacoes_estoque')
      .select(
        'id, empresa_id, produto_id, fornecedor_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at, produtos!inner(nome, codigo), usuarios(nome), fornecedores(nome)',
        { count: 'exact' },
      )
      .eq('empresa_id', empresaId)

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`, { foreignTable: 'produtos' })
    }

    if (tipo && tipo !== 'todos') {
      query = query.eq('tipo', tipo)
    }

    if (fornecedorId && fornecedorId !== 'todos') {
      query = (query as any).eq('fornecedor_id', fornecedorId)
    }

    if (dataInicio) {
      query = query.gte('created_at', new Date(`${dataInicio}T00:00:00`).toISOString())
    }

    if (dataFim) {
      query = query.lte('created_at', new Date(`${dataFim}T23:59:59.999`).toISOString())
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    return {
      data: data || [],
      totalCount: count || 0,
      error,
    }
  },

  /**
   * Conta movimentações filtradas.
   */
  async countMovimentacoesFiltered(
    empresaId: string,
    options: Omit<ListMovimentacoesOptions, 'page' | 'pageSize'> = {},
  ) {
    const { search, tipo, fornecedorId, dataInicio, dataFim } = options

    let query = supabase
      .from('movimentacoes_estoque')
      .select('id, produtos!inner(nome, codigo)', { count: 'exact' })
      .eq('empresa_id', empresaId)

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`, { foreignTable: 'produtos' })
    }

    if (tipo && tipo !== 'todos') {
      query = query.eq('tipo', tipo)
    }

    if (fornecedorId && fornecedorId !== 'todos') {
      query = (query as any).eq('fornecedor_id', fornecedorId)
    }

    if (dataInicio) {
      query = query.gte('created_at', new Date(`${dataInicio}T00:00:00`).toISOString())
    }

    if (dataFim) {
      query = query.lte('created_at', new Date(`${dataFim}T23:59:59.999`).toISOString())
    }

    const { count, error } = await query
    return { count: count || 0, error }
  },

  /**
   * Busca produtos ativos da empresa para preencher o select de Entrada de Estoque,
   * incluindo o saldo atual da tabela estoques.
   */
  async listProdutosAtivosParaEntrada(
    empresaId: string,
    search?: string,
  ): Promise<{ data: ProdutoParaEntrada[] | null; error: any }> {
    let query = supabase
      .from('produtos')
      .select('id, nome, codigo, unidade, preco_custo, estoque_minimo, estoques(quantidade)')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`nome.ilike.%${term}%,codigo.ilike.%${term}%`)
    }

    const { data, error } = await query

    if (error) {
      return { data: null, error }
    }

    const mapped: ProdutoParaEntrada[] = (data || []).map((p: any) => {
      const saldoQtd = Array.isArray(p.estoques)
        ? (p.estoques[0]?.quantidade ?? 0)
        : (p.estoques?.quantidade ?? 0)

      return {
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        unidade: p.unidade || 'UN',
        estoque_minimo: Number(p.estoque_minimo) || 0,
        preco_custo: Number(p.preco_custo) || 0,
        saldoAtual: Number(saldoQtd) || 0,
      }
    })

    return { data: mapped, error: null }
  },
}
