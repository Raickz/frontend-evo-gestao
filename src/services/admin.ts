import { supabase } from '@/lib/supabase/client'

export interface AdminDashboardData {
  total_empresas: number
  empresas_ativas: number
  empresas_trial: number
  trials_proximos_vencimento: number
  assinaturas_ativas: number
  assinaturas_atrasadas: number
  assinaturas_canceladas: number
  total_usuarios: number
  mrr: number
  distribuicao_por_plano: {
    plano_id: string
    plano_nome: string
    slug: string
    quantidade: number
  }[]
  receita_total?: number
  receita_mes?: number
  transacoes_aprovadas?: number
  transacoes_pendentes?: number
  transacoes_recusadas?: number
  ultimas_transacoes?: {
    id: string
    empresa_id: string
    empresa_nome: string
    empresa_nome_fantasia?: string
    plano_id: string
    plano_nome: string
    plano_slug: string
    valor: number
    gateway: string
    gateway_id?: string
    metodo_pagamento?: string
    status: string
    created_at: string
  }[]
}
export interface AdminEmpresaItem {
  id: string
  nome: string
  nome_fantasia: string | null
  cnpj: string | null
  email: string | null
  telefone: string | null
  status: string
  created_at: string
  plano_id: string | null
  plano_nome: string | null
  plano_slug: string | null
  status_assinatura: string | null
  valor_assinatura: number | null
  inicio: string | null
  vencimento: string | null
  fim_periodo_teste: string | null
  total_usuarios: number
}

export interface AdminPlanoItem {
  id: string
  nome: string
  slug: string
  descricao: string | null
  valor_mensal: number
  periodo_teste_dias: number
  limite_usuarios: number | null
  limite_vendedores: number | null
  limite_produtos: number | null
  limite_clientes: number | null
  limite_vendas_mes: number | null
  recursos: string[] | Record<string, any> | null
  ordem: number
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export interface AdminHistoricoItem {
  id: string
  empresa_id: string
  empresa_nome: string | null
  empresa_nome_fantasia: string | null
  plano_anterior_id: string | null
  plano_anterior_nome: string | null
  plano_novo_id: string | null
  plano_novo_nome: string | null
  valor_anterior: number | null
  valor_novo: number | null
  tipo:
    | 'criacao'
    | 'trial_inicio'
    | 'upgrade'
    | 'downgrade'
    | 'cancelamento'
    | 'reativacao'
    | 'bloqueio'
    | 'desbloqueio'
    | string
  usuario_responsavel_id: string | null
  usuario_responsavel_nome: string | null
  created_at: string
}

export interface CreatePlanoInput {
  nome: string
  slug: string
  descricao?: string | null
  valor_mensal: number
  periodo_teste_dias?: number
  limite_usuarios?: number | null
  limite_vendedores?: number | null
  limite_produtos?: number | null
  limite_clientes?: number | null
  limite_vendas_mes?: number | null
  recursos?: any
  ordem?: number
  ativo?: boolean
}

export interface EditPlanoInput extends CreatePlanoInput {}

export const AdminService = {
  /**
   * Obtém os indicadores agregados da plataforma EVO Gestão
   */
  async getDashboard(): Promise<{ data: AdminDashboardData | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_admin_dashboard')
      if (error) throw error
      return { data: data as unknown as AdminDashboardData, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Lista todas as empresas com seus respectivos planos e status de assinatura
   */
  async listarEmpresas(): Promise<{ data: AdminEmpresaItem[]; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('listar_empresas_admin')
      if (error) throw error
      return { data: (data as unknown as AdminEmpresaItem[]) || [], error: null }
    } catch (err: any) {
      return { data: [], error: err }
    }
  },

  /**
   * Bloqueia o acesso de uma empresa na plataforma
   */
  async bloquearEmpresa(
    empresaId: string,
  ): Promise<{ data: { success: boolean; message?: string; error?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('bloquear_empresa', {
        p_empresa_id: empresaId,
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        return { data: res, error: new Error(res.error || 'Falha ao bloquear empresa.') }
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Desbloqueia uma empresa na plataforma
   */
  async desbloquearEmpresa(
    empresaId: string,
  ): Promise<{ data: { success: boolean; message?: string; error?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('desbloquear_empresa', {
        p_empresa_id: empresaId,
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        return { data: res, error: new Error(res.error || 'Falha ao desbloquear empresa.') }
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Altera o plano de qualquer empresa sem restrição de downgrade
   */
  async alterarPlanoEmpresa(
    empresaId: string,
    planoSlug: string,
  ): Promise<{ data: { success: boolean; message?: string; error?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('alterar_plano_admin', {
        p_empresa_id: empresaId,
        p_novo_plano_slug: planoSlug,
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        return { data: res, error: new Error(res.error || 'Falha ao alterar plano.') }
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Lista todos os planos (ativos e inativos) para o painel administrativo
   */
  async listarPlanosAdmin(): Promise<{ data: AdminPlanoItem[]; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('listar_planos_admin')
      if (error) throw error
      return { data: (data as unknown as AdminPlanoItem[]) || [], error: null }
    } catch (err: any) {
      return { data: [], error: err }
    }
  },

  /**
   * Cria um novo plano na plataforma
   */
  async criarPlano(
    payload: CreatePlanoInput,
  ): Promise<{ data: { success: boolean; id?: string; error?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('criar_plano_admin', {
        p_nome: payload.nome,
        p_slug: payload.slug,
        p_descricao: payload.descricao || null,
        p_valor_mensal: payload.valor_mensal,
        p_periodo_teste_dias: payload.periodo_teste_dias ?? 0,
        p_limite_usuarios: payload.limite_usuarios ?? null,
        p_limite_vendedores: payload.limite_vendedores ?? null,
        p_limite_produtos: payload.limite_produtos ?? null,
        p_limite_clientes: payload.limite_clientes ?? null,
        p_limite_vendas_mes: payload.limite_vendas_mes ?? null,
        p_recursos: payload.recursos || [],
        p_ordem: payload.ordem ?? 0,
        p_ativo: payload.ativo ?? true,
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        return { data: res, error: new Error(res.error || 'Falha ao criar plano.') }
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Edita um plano existente
   */
  async editarPlano(
    planoId: string,
    payload: EditPlanoInput,
  ): Promise<{ data: { success: boolean; error?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('editar_plano_admin', {
        p_plano_id: planoId,
        p_nome: payload.nome,
        p_slug: payload.slug,
        p_descricao: payload.descricao || null,
        p_valor_mensal: payload.valor_mensal,
        p_periodo_teste_dias: payload.periodo_teste_dias ?? 0,
        p_limite_usuarios: payload.limite_usuarios ?? null,
        p_limite_vendedores: payload.limite_vendedores ?? null,
        p_limite_produtos: payload.limite_produtos ?? null,
        p_limite_clientes: payload.limite_clientes ?? null,
        p_limite_vendas_mes: payload.limite_vendas_mes ?? null,
        p_recursos: payload.recursos || [],
        p_ordem: payload.ordem ?? 0,
        p_ativo: payload.ativo ?? true,
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        return { data: res, error: new Error(res.error || 'Falha ao editar plano.') }
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Ativa ou inativa um plano
   */
  async togglePlanoAtivo(
    planoId: string,
    ativo: boolean,
  ): Promise<{ data: { success: boolean; error?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('toggle_plano_ativo', {
        p_plano_id: planoId,
        p_ativo: ativo,
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        return { data: res, error: new Error(res.error || 'Falha ao alterar status do plano.') }
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Lista o histórico de alterações em assinaturas
   */
  async listarHistorico(): Promise<{ data: AdminHistoricoItem[]; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('listar_historico_admin')
      if (error) throw error
      return { data: (data as unknown as AdminHistoricoItem[]) || [], error: null }
    } catch (err: any) {
      return { data: [], error: err }
    }
  },
}
