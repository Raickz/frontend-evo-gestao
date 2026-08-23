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
