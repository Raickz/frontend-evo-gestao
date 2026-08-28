import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Produto = Tables<'produtos'>
export type ProdutoInsert = TablesInsert<'produtos'>
export type ProdutoUpdate = TablesUpdate<'produtos'>
export type Categoria = Tables<'categorias'>
export type Fornecedor = Tables<'fornecedores'>

export const ProdutosService = {
  async list(empresaId: string) {
    return supabase
      .from('produtos')
      .select('*, categorias(nome), fornecedores(nome), estoques(quantidade)')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },

  async countAtivos(empresaId: string) {
    return supabase
      .from('produtos')
      .select('id', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
  },

  async getById(empresaId: string, id: string) {
    return supabase
      .from('produtos')
      .select('*, categorias(nome), fornecedores(nome), estoques(quantidade)')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  async createViaRpc(params: {
    nome: string
    codigo?: string
    categoriaId?: string
    fornecedorId?: string
    unidade?: string
    precoCusto?: number
    precoVenda?: number
    estoqueMinimo?: number
    estoqueInicial?: number
    descricao?: string
  }) {
    return supabase.rpc('criar_produto', {
      p_nome: params.nome,
      p_codigo: params.codigo,
      p_categoria_id: params.categoriaId,
      p_fornecedor_id: params.fornecedorId,
      p_unidade: params.unidade || 'UN',
      p_preco_custo: params.precoCusto || 0,
      p_preco_venda: params.precoVenda || 0,
      p_estoque_minimo: params.estoqueMinimo || 0,
      p_estoque_inicial: params.estoqueInicial || 0,
      p_descricao: params.descricao,
    })
  },

  async update(empresaId: string, id: string, data: ProdutoUpdate) {
    return supabase
      .from('produtos')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  async search(empresaId: string, termo: string) {
    const cleanTerm = termo.trim()
    if (!cleanTerm) {
      return this.list(empresaId)
    }
    return supabase
      .from('produtos')
      .select('*, categorias(nome), fornecedores(nome), estoques(quantidade)')
      .eq('empresa_id', empresaId)
      .or(`nome.ilike.%${cleanTerm}%,codigo.ilike.%${cleanTerm}%`)
      .order('nome', { ascending: true })
  },

  async toggleAtivo(_empresaId: string, id: string, ativo: boolean) {
    const { data, error } = await supabase.rpc(
      'alterar_status_produto' as any,
      {
        p_produto_id: id,
        p_ativo: ativo,
      } as any,
    )
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data: data as any, error: null }
  },

  async listCategorias(empresaId: string) {
    return supabase
      .from('categorias')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },

  async listFornecedores(empresaId: string) {
    return supabase
      .from('fornecedores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },
}
