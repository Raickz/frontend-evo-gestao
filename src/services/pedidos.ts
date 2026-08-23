/**
 * Pedidos Service
 *
 * NOTAS DE ARQUITETURA E SCHEMA REAL DO SUPABASE:
 * -----------------------------------------------------------------------------------------
 * 1. Estrutura Real da Tabela `pedidos`:
 *    - id (uuid, PK)
 *    - empresa_id (uuid, FK -> empresas.id)
 *    - cliente_id (uuid, FK -> clientes.id, nullable)
 *    - vendedor_id (uuid, FK -> vendedores.id, nullable)
 *    - numero (bigint, autogerado pela sequence/trigger)
 *    - total (numeric, default 0)
 *    - status (text, default 'pendente')
 *    - observacoes (text, nullable)
 *    - created_at, updated_at (timestamptz)
 *    - Policies RLS: INSERT, SELECT, UPDATE
 *
 * 2. Estrutura Real da Tabela `itens_pedido`:
 *    - id (uuid, PK)
 *    - empresa_id (uuid, FK -> empresas.id)
 *    - pedido_id (uuid, FK -> pedidos.id)
 *    - produto_id (uuid, FK -> produtos.id)
 *    - quantidade (numeric)
 *    - preco_unitario (numeric, default 0)
 *    - desconto (numeric, default 0)
 *    - subtotal (numeric, default 0)
 *    - Policy RLS: SOMENTE SELECT (não possui políticas de INSERT nem UPDATE configuradas no Supabase).
 *
 * 3. Status Existentes em Pedidos:
 *    - 'pendente' (default)
 *    - 'confirmado'
 *    - 'faturado'
 *    - 'cancelado'
 *
 * 4. RPCs Existentes:
 *    - `criar_pedido`: RPC que cria o pedido e seus itens de forma atômica, buscando os preços oficiais dos produtos.
 *
 * 5. Limitações de Negócio / Backend Conhecidas:
 *    - Limitação 1: Sem RPC para conversão em venda. O botão 'Converter em Venda' deve permanecer
 *      desabilitado com tooltip informativo, sem realizar inserções parciais em tabelas de vendas.
 * -----------------------------------------------------------------------------------------
 */

import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export type Pedido = Tables<'pedidos'>
export type ItemPedido = Tables<'itens_pedido'>

export interface ListPedidosFilters {
  search?: string
  status?: string
  dataInicio?: string
  dataFim?: string
  pagina?: number
  limite?: number
}

export interface PedidoItemInput {
  produto_id: string
  quantidade: number
  preco_unitario: number
  desconto?: number
  subtotal: number
}

export interface CreatePedidoData {
  cliente_id?: string | null
  vendedor_id?: string | null
  total: number
  status?: string
  observacoes?: string | null
  itens?: PedidoItemInput[]
}

export interface CriarPedidoRpcItem {
  produto_id: string
  quantidade: number
  desconto?: number
}

export interface CriarPedidoRpcData {
  cliente_id?: string | null
  vendedor_id?: string | null
  itens: CriarPedidoRpcItem[]
  observacoes?: string | null
}

export interface UpdatePedidoData {
  cliente_id?: string | null
  vendedor_id?: string | null
  observacoes?: string | null
  total?: number
}

export const PedidosService = {
  /**
   * Lista paginada (20/pág padrão) com joins clientes(nome, documento, telefone) e vendedores(nome).
   * Filtros: busca textual no nome do cliente / número / observações, status, período (created_at).
   * Ordenação: created_at DESC.
   */
  async listFiltered(empresaId: string, options: ListPedidosFilters = {}) {
    const { search, status, dataInicio, dataFim, pagina = 1, limite = 20 } = options

    let query = supabase
      .from('pedidos')
      .select('*, clientes(id, nome, documento, telefone), vendedores(id, nome)')
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('created_at', `${dataInicio}T00:00:00.000Z`)
    }

    if (dataFim) {
      query = query.lte('created_at', `${dataFim}T23:59:59.999Z`)
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

    const from = (pagina - 1) * limite
    const to = from + limite - 1

    return query.order('created_at', { ascending: false }).range(from, to)
  },

  /**
   * Contagem de pedidos com head:true + count:exact para paginação.
   */
  async countFiltered(empresaId: string, options: ListPedidosFilters = {}) {
    const { search, status, dataInicio, dataFim } = options

    let query = supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (dataInicio) {
      query = query.gte('created_at', `${dataInicio}T00:00:00.000Z`)
    }

    if (dataFim) {
      query = query.lte('created_at', `${dataFim}T23:59:59.999Z`)
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

  /**
   * Busca detalhes completos do pedido por ID:
   * pedido com clientes(*), vendedores(*), itens_pedido(*, produtos(nome, codigo, unidade, preco_venda))
   */
  async getById(empresaId: string, id: string) {
    return supabase
      .from('pedidos')
      .select(
        '*, clientes(*), vendedores(*), itens_pedido(*, produtos(nome, codigo, unidade, preco_venda))',
      )
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  /**
   * Tenta criar um pedido e seus itens.
   * NOTA: `pedidos` possui policy de INSERT, mas `itens_pedido` SOMENTE tem policy de SELECT.
   * A inserção de itens falhará por política de RLS do Supabase até que uma RPC ou policy seja criada no backend.
   * Este método insere o cabeçalho e tenta inserir os itens, reportando erro se falhar.
   */
  /**
   * Cria um pedido via RPC `criar_pedido` no Supabase (atômico e com cálculo de preços no backend).
   */
  async criarViaRpc(empresaId: string, data: CriarPedidoRpcData) {
    return supabase.rpc('criar_pedido', {
      p_cliente_id: data.cliente_id || null,
      p_vendedor_id: data.vendedor_id || null,
      p_itens: data.itens.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        desconto: item.desconto || 0,
      })),
      p_observacoes: data.observacoes || null,
    })
  },

  /**
   * Tenta criar um pedido e seus itens via INSERT direto (legado).
   * NOTA: A criação recomendada é via `criarViaRpc`.
   */
  async create(empresaId: string, data: CreatePedidoData) {
    // 1. Inserir cabeçalho do pedido
    const { data: pedidoCriado, error: pedidoErr } = await supabase
      .from('pedidos')
      .insert({
        empresa_id: empresaId,
        cliente_id: data.cliente_id || null,
        vendedor_id: data.vendedor_id || null,
        total: data.total || 0,
        status: data.status || 'pendente',
        observacoes: data.observacoes?.trim() || null,
      })
      .select()
      .single()

    if (pedidoErr || !pedidoCriado) {
      return { data: null, error: pedidoErr || new Error('Falha ao criar cabeçalho do pedido') }
    }

    // 2. Se houver itens, tentar inserir em itens_pedido (vai falhar devido à policy apenas SELECT)
    if (data.itens && data.itens.length > 0) {
      const itensParaInserir = data.itens.map((item) => ({
        empresa_id: empresaId,
        pedido_id: pedidoCriado.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto: item.desconto || 0,
        subtotal: item.subtotal,
      }))

      const { error: itensErr } = await supabase.from('itens_pedido').insert(itensParaInserir)

      if (itensErr) {
        return {
          data: pedidoCriado,
          error: itensErr,
          itensFailed: true,
          message:
            'O cabeçalho do pedido foi criado, mas a inserção dos itens falhou por restrição de política RLS no banco de dados (itens_pedido é somente SELECT). É necessária uma RPC no backend.',
        }
      }
    }

    return { data: pedidoCriado, error: null }
  },

  /**
   * Atualiza dados de um pedido (somente campos de cabeçalho permitidos: cliente, vendedor, observações).
   */
  async update(empresaId: string, id: string, data: UpdatePedidoData) {
    return supabase
      .from('pedidos')
      .update({
        cliente_id: data.cliente_id !== undefined ? data.cliente_id : undefined,
        vendedor_id: data.vendedor_id !== undefined ? data.vendedor_id : undefined,
        observacoes: data.observacoes !== undefined ? data.observacoes : undefined,
        total: data.total !== undefined ? data.total : undefined,
      })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  /**
   * Exclui um pedido pelo ID (ex: cleanup em falhas).
   */
  async delete(empresaId: string, id: string) {
    return supabase.from('pedidos').delete().eq('empresa_id', empresaId).eq('id', id)
  },

  /**
   * Atualiza o status do pedido (ex: 'pendente', 'confirmado', 'faturado', 'cancelado').
   */
  async updateStatus(empresaId: string, id: string, status: string) {
    return supabase
      .from('pedidos')
      .update({ status })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  /**
   * Lista clientes ativos para seleção no formulário de pedidos.
   */
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

  /**
   * Lista vendedores ativos para seleção no formulário de pedidos.
   */
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

  /**
   * Lista produtos disponíveis e ativos com join em estoques(quantidade) para o catálogo.
   */
  async listProdutosDisponiveis(empresaId: string, search?: string) {
    let query = supabase
      .from('produtos')
      .select(
        'id, nome, codigo, codigo_barras, preco_venda, preco_custo, unidade, estoque_minimo, estoques(quantidade)',
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
}
