import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Vendedor = Tables<'vendedores'> & {
  usuarios?: {
    id?: string
    nome: string
    email: string
  } | null
  total_vendas?: number
}

export type VendedorInsert = TablesInsert<'vendedores'>
export type VendedorUpdate = TablesUpdate<'vendedores'>

export interface VendedorSearchOptions {
  page?: number
  pageSize?: number
}

export const VendedoresService = {
  /**
   * Lista todos os vendedores da empresa com informações do usuário vinculado
   * e total de vendas realizadas por cada vendedor.
   */
  async list(empresaId: string) {
    const [vendedoresRes, vendasRes] = await Promise.all([
      supabase
        .from('vendedores')
        .select('*, usuarios(id, nome, email)')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true }),
      supabase.from('vendas').select('vendedor_id').eq('empresa_id', empresaId),
    ])

    if (vendedoresRes.error) {
      return { data: null, error: vendedoresRes.error }
    }

    // Calcula a contagem de vendas por vendedor
    const vendasCountMap: Record<string, number> = {}
    if (vendasRes.data) {
      for (const v of vendasRes.data) {
        if (v.vendedor_id) {
          vendasCountMap[v.vendedor_id] = (vendasCountMap[v.vendedor_id] || 0) + 1
        }
      }
    }

    const mergedData = (vendedoresRes.data || []).map((v) => ({
      ...v,
      total_vendas: vendasCountMap[v.id] || 0,
    }))

    return { data: mergedData as Vendedor[], error: null }
  },

  /**
   * Busca paginada (20 por página padrão) por nome via ilike com contagem exata,
   * join com usuarios e contagem de vendas.
   */
  async search(
    empresaId: string,
    termo: string,
    options: VendedorSearchOptions = { page: 1, pageSize: 20 },
  ) {
    const cleanTerm = termo.trim()
    const page = Math.max(1, options.page || 1)
    const pageSize = options.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('vendedores')
      .select('*, usuarios(id, nome, email)', { count: 'exact' })
      .eq('empresa_id', empresaId)

    if (cleanTerm) {
      query = query.ilike('nome', `%${cleanTerm}%`)
    }

    const [vendedoresRes, vendasRes] = await Promise.all([
      query.order('nome', { ascending: true }).range(from, to),
      supabase.from('vendas').select('vendedor_id').eq('empresa_id', empresaId),
    ])

    if (vendedoresRes.error) {
      return { data: null, count: 0, error: vendedoresRes.error }
    }

    const vendasCountMap: Record<string, number> = {}
    if (vendasRes.data) {
      for (const v of vendasRes.data) {
        if (v.vendedor_id) {
          vendasCountMap[v.vendedor_id] = (vendasCountMap[v.vendedor_id] || 0) + 1
        }
      }
    }

    const mergedData = (vendedoresRes.data || []).map((v) => ({
      ...v,
      total_vendas: vendasCountMap[v.id] || 0,
    }))

    return {
      data: mergedData as Vendedor[],
      count: vendedoresRes.count || 0,
      error: null,
    }
  },

  /**
   * Busca vendedor específico por ID
   */
  async getById(empresaId: string, id: string) {
    return supabase
      .from('vendedores')
      .select('*, usuarios(id, nome, email)')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  /**
   * Criação de novo vendedor via RPC `criar_vendedor` com validação atômica de limites.
   */
  async create(_empresaId: string, data: Omit<TablesInsert<'vendedores'>, 'empresa_id'>) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'criar_vendedor' as any,
      {
        p_usuario_id: data.usuario_id || null,
        p_nome: data.nome,
        p_percentual_comissao: data.percentual_comissao || 0,
      } as any,
    )

    if (rpcError) {
      return { data: null, error: { message: rpcError.message } }
    }

    const res = rpcData as { sucesso?: boolean; vendedor_id?: string; nome?: string } | null
    if (!res || !res.sucesso || !res.vendedor_id) {
      return { data: null, error: { message: 'Falha ao cadastrar vendedor.' } }
    }

    // Buscar o registro do vendedor completo com dados do usuário vinculado para retorno padrão
    const { data: vendedorData, error: fetchError } = await supabase
      .from('vendedores')
      .select('*, usuarios(id, nome, email)')
      .eq('id', res.vendedor_id)
      .single()

    if (fetchError) {
      return { data: null, error: { message: fetchError.message } }
    }

    return { data: vendedorData as Vendedor, error: null }
  },

  /**
   * Atualização de vendedor existente
   */
  async update(empresaId: string, id: string, data: TablesUpdate<'vendedores'>) {
    return supabase
      .from('vendedores')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('*, usuarios(id, nome, email)')
      .single()
  },

  /**
   * Alterna o status ativo/inativo do vendedor (exclusão lógica) via RPC com validação atômica de limites
   */
  async toggleAtivo(_empresaId: string, id: string, ativo: boolean) {
    const { data, error } = await supabase.rpc(
      'alterar_status_vendedor' as any,
      {
        p_vendedor_id: id,
        p_ativo: ativo,
      } as any,
    )
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data: data as any, error: null }
  },

  /**
   * Lista usuários ativos da empresa para seleção no formulário de vínculo
   */
  async listUsuariosDisponiveis(empresaId: string) {
    return supabase
      .from('usuarios')
      .select('id, nome, email, perfil')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome', { ascending: true })
  },

  /**
   * Consulta comissões do vendedor (mantida para compatibilidade)
   */
  async listComissoes(empresaId: string) {
    return supabase
      .from('comissoes')
      .select('*, vendedores(nome), vendas(numero, total)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
  },
}
