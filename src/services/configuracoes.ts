import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesUpdate } from '@/lib/supabase/types'

export type Empresa = Tables<'empresas'>
export type Usuario = Tables<'usuarios'>
export type Plano = Tables<'planos'>
export type Assinatura = Tables<'assinaturas'>

export interface ListUsuariosOptions {
  search?: string
  perfil?: string
  status?: 'todos' | 'ativo' | 'inativo'
  excludeMasters?: boolean
  page?: number
  pageSize?: number
}

export interface CountUsuariosOptions {
  search?: string
  perfil?: string
  status?: 'todos' | 'ativo' | 'inativo'
  excludeMasters?: boolean
}

export interface UpdateEmpresaData {
  nome?: string
  nome_fantasia?: string
  cnpj?: string
  email?: string
  telefone?: string
  logo_url?: string
}

export const ConfiguracoesService = {
  async getEmpresa(empresaId: string) {
    return supabase.from('empresas').select('*').eq('id', empresaId).single()
  },

  async updateEmpresa(empresaId: string, data: UpdateEmpresaData) {
    const payload: TablesUpdate<'empresas'> = {
      updated_at: new Date().toISOString(),
    }
    if (data.nome !== undefined) payload.nome = data.nome
    if (data.nome_fantasia !== undefined) payload.nome_fantasia = data.nome_fantasia
    if (data.cnpj !== undefined) payload.cnpj = data.cnpj
    if (data.email !== undefined) payload.email = data.email
    if (data.telefone !== undefined) payload.telefone = data.telefone
    if (data.logo_url !== undefined) payload.logo_url = data.logo_url

    return supabase.from('empresas').update(payload).eq('id', empresaId).select().single()
  },

  async getAssinaturaComPlano(empresaId: string) {
    return supabase
      .from('assinaturas')
      .select('*, planos(*)')
      .eq('empresa_id', empresaId)
      .maybeSingle()
  },

  async listUsuariosEmpresa(empresaId: string, options?: ListUsuariosOptions) {
    let query = supabase.from('usuarios').select('*').eq('empresa_id', empresaId)

    if (options?.excludeMasters) {
      query = query.neq('perfil', 'master')
    }

    if (options?.search && options.search.trim() !== '') {
      const term = `%${options.search.trim()}%`
      query = query.or(`nome.ilike.${term},email.ilike.${term}`)
    }

    if (options?.perfil && options.perfil !== 'todos') {
      query = query.eq('perfil', options.perfil.toLowerCase())
    }

    if (options?.status && options.status !== 'todos') {
      query = query.eq('ativo', options.status === 'ativo')
    }

    query = query.order('nome', { ascending: true })

    if (options?.page && options?.pageSize) {
      const from = (options.page - 1) * options.pageSize
      const to = from + options.pageSize - 1
      query = query.range(from, to)
    }

    return query
  },

  async countUsuariosEmpresa(empresaId: string, options?: CountUsuariosOptions) {
    let query = supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)

    if (options?.excludeMasters) {
      query = query.neq('perfil', 'master')
    }

    if (options?.search && options.search.trim() !== '') {
      const term = `%${options.search.trim()}%`
      query = query.or(`nome.ilike.${term},email.ilike.${term}`)
    }

    if (options?.perfil && options.perfil !== 'todos') {
      query = query.eq('perfil', options.perfil.toLowerCase())
    }

    if (options?.status && options.status !== 'todos') {
      query = query.eq('ativo', options.status === 'ativo')
    }

    return query
  },

  async toggleUsuarioAtivo(usuarioId: string, ativo: boolean) {
    return supabase
      .from('usuarios')
      .update({
        ativo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuarioId)
      .select()
      .single()
  },

  async updateUsuarioPerfil(usuarioId: string, perfil: string) {
    return supabase
      .from('usuarios')
      .update({
        perfil: perfil.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuarioId)
      .select()
      .single()
  },

  async createUsuario(data: { nome: string; email: string; perfil: string; senha: string }) {
    // Obter token de sessão atual
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { data: null, error: new Error('Sessão não encontrada.') }
    }

    // Chamar a Edge Function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      },
    )

    let result: any
    try {
      result = await response.json()
    } catch {
      return { data: null, error: new Error('Resposta inválida do servidor.') }
    }

    if (!response.ok || !result.sucesso) {
      return { data: null, error: new Error(result?.erro || 'Falha ao criar usuário.') }
    }
    return { data: result.usuario, error: null }
  },
}
