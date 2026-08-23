import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export type Empresa = Tables<'empresas'>
export type Usuario = Tables<'usuarios'>
export type Plano = Tables<'planos'>
export type Assinatura = Tables<'assinaturas'>

export const ConfiguracoesService = {
  async getEmpresa(empresaId: string) {
    return supabase.from('empresas').select('*').eq('id', empresaId).single()
  },

  async getAssinaturaComPlano(empresaId: string) {
    return supabase
      .from('assinaturas')
      .select('*, planos(*)')
      .eq('empresa_id', empresaId)
      .maybeSingle()
  },

  async listUsuariosEmpresa(empresaId: string) {
    return supabase
      .from('usuarios')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },
}
