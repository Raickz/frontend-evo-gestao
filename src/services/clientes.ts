import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Cliente = Tables<'clientes'>
export type ClienteInsert = TablesInsert<'clientes'>
export type ClienteUpdate = TablesUpdate<'clientes'>

export const ClientesService = {
  async list(empresaId: string) {
    return supabase
      .from('clientes')
      .select('*, vendedores(nome)')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },

  async countAtivos(empresaId: string) {
    return supabase
      .from('clientes')
      .select('id', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
  },

  async getById(empresaId: string, id: string) {
    return supabase
      .from('clientes')
      .select('*, vendedores(nome)')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  async create(_empresaId: string, data: Omit<ClienteInsert, 'empresa_id'>) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'criar_cliente' as any,
      {
        p_nome: data.nome,
        p_documento: data.documento || null,
        p_telefone: data.telefone || null,
        p_whatsapp: data.whatsapp || null,
        p_email: data.email || null,
        p_cep: data.cep || null,
        p_estado: data.estado || null,
        p_cidade: data.cidade || null,
        p_endereco: data.endereco || null,
        p_numero: data.numero || null,
        p_bairro: data.bairro || null,
        p_limite_credito: data.limite_credito || 0,
        p_observacoes: data.observacoes || null,
        p_vendedor_id: data.vendedor_id || null,
      } as any,
    )

    if (rpcError) {
      return { data: null, error: { message: rpcError.message } }
    }

    const res = rpcData as { sucesso?: boolean; cliente_id?: string; nome?: string } | null
    if (!res || !res.sucesso || !res.cliente_id) {
      return { data: null, error: { message: 'Falha ao cadastrar cliente.' } }
    }

    const { data: clienteData, error: fetchError } = await supabase
      .from('clientes')
      .select('*, vendedores(nome)')
      .eq('id', res.cliente_id)
      .single()

    if (fetchError) {
      return { data: null, error: { message: fetchError.message } }
    }

    return { data: clienteData as Cliente, error: null }
  },

  async update(empresaId: string, id: string, data: ClienteUpdate) {
    return supabase
      .from('clientes')
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
    // Search by nome, documento, or telefone using PostgREST ilike
    return supabase
      .from('clientes')
      .select('*, vendedores(nome)')
      .eq('empresa_id', empresaId)
      .or(`nome.ilike.%${cleanTerm}%,documento.ilike.%${cleanTerm}%,telefone.ilike.%${cleanTerm}%`)
      .order('nome', { ascending: true })
  },

  async toggleAtivo(_empresaId: string, id: string, ativo: boolean) {
    const { data, error } = await supabase.rpc(
      'alterar_status_cliente' as any,
      {
        p_cliente_id: id,
        p_ativo: ativo,
      } as any,
    )
    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data: data as any, error: null }
  },
}
