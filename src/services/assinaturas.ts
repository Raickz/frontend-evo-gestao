import { supabase } from '@/lib/supabase/client'

export type AssinaturaStatus =
  | 'trial'
  | 'ativa'
  | 'pendente'
  | 'atrasada'
  | 'cancelada'
  | 'bloqueada'

export interface Plano {
  id: string
  nome: string
  slug: string | null
  descricao: string | null
  valor_mensal: number
  periodo_teste_dias: number | null
  limite_usuarios: number | null
  limite_vendedores: number | null
  limite_produtos: number | null
  limite_clientes: number | null
  limite_vendas_mes: number | null
  recursos: string[] | Record<string, any> | null
  ordem: number | null
  ativo: boolean
  created_at?: string
  updated_at?: string | null
}

export interface AssinaturaComPlano {
  id: string
  empresa_id: string
  plano_id: string
  valor: number
  inicio: string
  vencimento: string | null
  fim_periodo_teste: string | null
  proxima_cobranca: string | null
  cancelada_em: string | null
  status: AssinaturaStatus
  created_at: string
  updated_at: string
  planos?: Plano | null
}

export interface StatusAssinatura {
  status: string
  plano_nome: string | null
  plano_slug: string | null
  fim_periodo_teste: string | null
  dias_restantes: number
  acesso_permitido: boolean
  motivo_bloqueio: string | null
}

export const AssinaturasService = {
  /**
   * Obtém o status consolidado da assinatura da empresa via RPC centralizada get_status_assinatura()
   */
  async getStatus(): Promise<{ data: StatusAssinatura | null; error: any }> {
    const { data, error } = await supabase.rpc('get_status_assinatura')
    if (error) {
      return { data: null, error }
    }
    return { data: data as unknown as StatusAssinatura, error: null }
  },

  /**
   * Obtém a assinatura da empresa logada com dados do plano vinculado
   */
  async getByEmpresaId(
    empresaId: string,
  ): Promise<{ data: AssinaturaComPlano | null; error: any }> {
    if (!empresaId) {
      return { data: null, error: new Error('empresa_id é obrigatório') }
    }

    try {
      const { data, error } = await supabase
        .from('assinaturas')
        .select(`
          id,
          empresa_id,
          plano_id,
          valor,
          inicio,
          vencimento,
          fim_periodo_teste,
          proxima_cobranca,
          cancelada_em,
          status,
          created_at,
          updated_at,
          planos (
            id,
            nome,
            slug,
            descricao,
            valor_mensal,
            periodo_teste_dias,
            limite_usuarios,
            limite_vendedores,
            limite_produtos,
            limite_clientes,
            limite_vendas_mes,
            recursos,
            ordem,
            ativo
          )
        `)
        .eq('empresa_id', empresaId)
        .maybeSingle()

      if (error) throw error

      return { data: (data as unknown as AssinaturaComPlano) ?? null, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Lista todos os planos disponíveis cadastrados
   */
  async listPlanos(): Promise<{ data: Plano[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      if (error) throw error
      return { data: (data as Plano[]) ?? [], error: null }
    } catch (err: any) {
      return { data: [], error: err }
    }
  },
}
