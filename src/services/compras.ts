import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

// Extended / fallback types for compras & itens_compra since types.ts might not yet include newly migrated tables
export type Compra =
  | (Tables<any> & {
      id: string
      empresa_id: string
      fornecedor_id: string
      numero: number
      total: number
      status: 'rascunho' | 'confirmada' | 'cancelada'
      observacoes: string | null
      data_compra: string
      forma_pagamento: string
      vencimento: string | null
      valor_pago: number
      created_by: string | null
      created_at: string
      updated_at: string
    })
  | any

export type ItemCompra =
  | (Tables<any> & {
      id: string
      empresa_id: string
      compra_id: string
      produto_id: string
      quantidade: number
      preco_unitario: number
      subtotal: number
    })
  | any

export interface ListComprasOptions {
  search?: string
  status?: string
  dataInicio?: string
  dataFim?: string
  page?: number
  pageSize?: number
}

export interface ItemCompraInput {
  produto_id: string
  quantidade: number
  preco_unitario: number
}

export interface CriarCompraData {
  fornecedor_id: string
  itens: ItemCompraInput[]
  observacoes?: string
  data_compra?: string
  forma_pagamento?: string
  vencimento?: string | null
  valor_pago?: number
}

export interface UpdateCompraData {
  fornecedor_id?: string
  observacoes?: string | null
  data_compra?: string
  forma_pagamento?: string
  vencimento?: string | null
  valor_pago?: number
  itens?: ItemCompraInput[]
}

export interface ComprasIndicadores {
  totalCompras: number
  valorCompras: number
  comprasConfirmadas: number
  comprasPendentes: number
}

export interface FornecedorOption {
  id: string
  nome: string
  documento: string | null
  telefone: string | null
  email: string | null
}

export interface ProdutoDisponivelOption {
  id: string
  nome: string
  codigo: string | null
  codigo_barras: string | null
  preco_custo: number
  preco_venda: number
  unidade: string
  estoque_minimo: number
  estoques: { quantidade: number }[] | null
}

export const ComprasService = {
  /**
   * Lista paginada (padrão 20/pág) com join em fornecedores(nome)
   * Filtros: search (número da compra ou nome do fornecedor), status, dataInicio, dataFim.
   * Ordenação: created_at DESC.
   */
  async list(empresaId: string, options: ListComprasOptions = {}) {
    const { search, status, dataInicio, dataFim, page = 1, pageSize = 20 } = options

    let query = supabase
      .from('compras')
      .select('*, fornecedores(id, nome, documento, telefone)')
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('data_compra', dataInicio)
    }

    if (dataFim) {
      query = query.lte('data_compra', dataFim)
    }

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      const isNumeric = /^\d+$/.test(cleanTerm)
      if (isNumeric) {
        query = query.or(`numero.eq.${cleanTerm},observacoes.ilike.%${cleanTerm}%`)
      } else {
        query = query.or(`observacoes.ilike.%${cleanTerm}%,fornecedores.nome.ilike.%${cleanTerm}%`)
      }
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    return query.order('created_at', { ascending: false }).range(from, to)
  },

  /**
   * Count exato para paginação
   */
  async count(empresaId: string, options: ListComprasOptions = {}) {
    const { search, status, dataInicio, dataFim } = options

    let query = supabase
      .from('compras')
      .select('id, fornecedores!inner(nome)', { count: 'exact' })
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('data_compra', dataInicio)
    }

    if (dataFim) {
      query = query.lte('data_compra', dataFim)
    }

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      const isNumeric = /^\d+$/.test(cleanTerm)
      if (isNumeric) {
        query = query.or(`numero.eq.${cleanTerm},observacoes.ilike.%${cleanTerm}%`)
      } else {
        query = query.or(`observacoes.ilike.%${cleanTerm}%,fornecedores.nome.ilike.%${cleanTerm}%`)
      }
    }

    return query
  },

  /**
   * Busca compra por ID + itens_compra + produtos + fornecedores
   */
  async getById(empresaId: string, id: string) {
    return supabase
      .from('compras')
      .select(
        '*, fornecedores(*), itens_compra(*, produtos(id, nome, codigo, unidade, preco_custo, preco_venda, foto_url))',
      )
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  /**
   * Atualiza compra em rascunho (cabeçalho e itens se fornecidos)
   */
  async update(empresaId: string, id: string, data: UpdateCompraData) {
    // 1. Atualiza cabeçalho
    const updatePayload: TablesUpdate<'compras'> = {
      updated_at: new Date().toISOString(),
    }

    if (data.fornecedor_id !== undefined) updatePayload.fornecedor_id = data.fornecedor_id
    if (data.observacoes !== undefined) updatePayload.observacoes = data.observacoes
    if (data.data_compra !== undefined) updatePayload.data_compra = data.data_compra
    if (data.forma_pagamento !== undefined) updatePayload.forma_pagamento = data.forma_pagamento
    if (data.vencimento !== undefined) updatePayload.vencimento = data.vencimento
    if (data.valor_pago !== undefined) updatePayload.valor_pago = data.valor_pago

    // Se itens foram fornecidos, recalcula total e atualiza itens_compra
    if (data.itens && data.itens.length > 0) {
      let novoTotal = 0
      const itensComSubtotal: TablesInsert<'itens_compra'>[] = data.itens.map((it) => {
        const sub = Math.round(it.quantidade * it.preco_unitario * 100) / 100
        novoTotal += sub
        return {
          empresa_id: empresaId,
          compra_id: id,
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
          subtotal: sub,
        }
      })
      updatePayload.total = novoTotal

      // Deletar itens antigos e inserir novos
      await supabase.from('itens_compra').delete().eq('compra_id', id).eq('empresa_id', empresaId)
      const { error: insError } = await supabase.from('itens_compra').insert(itensComSubtotal)
      if (insError) throw insError
    }

    return supabase
      .from('compras')
      .update(updatePayload)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  /**
   * Cancela uma compra em rascunho (direto no banco)
   */
  async cancelar(empresaId: string, id: string) {
    return supabase
      .from('compras')
      .update({ status: 'cancelada', updated_at: new Date().toISOString() })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  /**
   * Chama a RPC `criar_compra` para criar rascunho de compra com itens
   */
  async criarCompra(empresaId: string, data: CriarCompraData) {
    return (supabase.rpc as any)('criar_compra', {
      p_fornecedor_id: data.fornecedor_id,
      p_itens: data.itens.map((it) => ({
        produto_id: it.produto_id,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
      })),
      p_observacoes: data.observacoes || '',
      p_data_compra: data.data_compra || new Date().toISOString().split('T')[0],
      p_forma_pagamento: data.forma_pagamento || 'a_prazo',
      p_vencimento: data.vencimento || null,
      p_valor_pago: data.valor_pago || 0,
    })
  },

  /**
   * Chama a RPC `confirmar_compra`
   */
  async confirmarCompra(compraId: string) {
    return (supabase.rpc as any)('confirmar_compra', {
      p_compra_id: compraId,
    })
  },

  /**
   * Lista fornecedores ativos para seleção
   */
  async listFornecedoresAtivos(empresaId: string, search?: string) {
    let query = supabase
      .from('fornecedores')
      .select('id, nome, documento, telefone, email')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)

    if (search && search.trim()) {
      const cleanTerm = search.trim()
      query = query.or(`nome.ilike.%${cleanTerm}%,documento.ilike.%${cleanTerm}%`)
    }

    return query.order('nome', { ascending: true })
  },

  /**
   * Lista produtos ativos com join estoques(quantidade) para seleção
   */
  async listProdutosDisponiveis(empresaId: string, search?: string) {
    let query = supabase
      .from('produtos')
      .select(
        'id, nome, codigo, codigo_barras, preco_custo, preco_venda, unidade, estoque_minimo, foto_url, estoques(quantidade)',
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

  /**
   * Busca conta a pagar vinculada à compra (se confirmada)
   */
  async getContaPagarPorCompra(empresaId: string, fornecedorId: string, numeroCompra: number) {
    return supabase
      .from('contas_pagar')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('fornecedor_id', fornecedorId)
      .ilike('descricao', `%Compra #${numeroCompra}%`)
      .maybeSingle()
  },

  /**
   * KPIs / Indicadores:
   * totalCompras (count), valorCompras (sum total), comprasConfirmadas, comprasPendentes (rascunho)
   */
  async getIndicadores(
    empresaId: string,
  ): Promise<{ data: ComprasIndicadores | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('compras')
        .select('total, status')
        .eq('empresa_id', empresaId)

      if (error) throw error

      let totalCompras = 0
      let valorCompras = 0
      let comprasConfirmadas = 0
      let comprasPendentes = 0

      if (data) {
        totalCompras = data.length
        for (const c of data) {
          const val = Number(c.total) || 0
          valorCompras += val
          if (c.status === 'confirmada') {
            comprasConfirmadas++
          } else if (c.status === 'rascunho') {
            comprasPendentes++
          }
        }
      }

      return {
        data: {
          totalCompras,
          valorCompras,
          comprasConfirmadas,
          comprasPendentes,
        },
        error: null,
      }
    } catch (err) {
      return { data: null, error: err }
    }
  },
}
