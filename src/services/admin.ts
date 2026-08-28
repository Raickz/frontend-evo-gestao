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
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  email: string | null
  telefone: string | null
  whatsapp?: string | null
  cep?: string | null
  estado?: string | null
  cidade?: string | null
  bairro?: string | null
  endereco?: string | null
  numero?: string | null
  complemento?: string | null
  observacoes?: string | null
  responsavel_nome?: string | null
  responsavel_cpf?: string | null
  responsavel_email?: string | null
  responsavel_telefone?: string | null
  responsavel_whatsapp?: string | null
  responsavel_cargo?: string | null
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

export interface AdminAssinaturaItem {
  id: string
  empresa_id: string
  empresa_nome: string
  empresa_nome_fantasia: string | null
  empresa_cnpj: string | null
  empresa_email: string | null
  empresa_telefone: string | null
  empresa_status: string
  plano_id: string | null
  plano_nome: string
  plano_slug: string | null
  limite_usuarios: number | null
  limite_vendedores: number | null
  limite_clientes: number | null
  limite_produtos: number | null
  recursos: any
  status: string
  valor: number
  valor_contratado?: number | null
  desconto?: number | null
  periodicidade?: string | null
  data_contratacao?: string | null
  inicio: string
  vencimento: string | null
  fim_periodo_teste: string | null
  proxima_cobranca: string | null
  cancelada_em: string | null
  gateway: string | null
  metodo_pagamento: string | null
  observacoes_comerciais?: string | null
  motivo_suspensao?: string | null
  observacao_suspensao?: string | null
  motivo_cancelamento?: string | null
  observacao_cancelamento?: string | null
  created_at: string
  updated_at: string
  ultimo_pagamento?: {
    id: string
    valor: number
    data: string
    metodo: string | null
    gateway: string
    status: string
  } | null
  total_usuarios_ativos: number
}

export interface AdminAssinaturasKPIs {
  total_assinaturas: number
  ativas: number
  em_teste: number
  vencendo_breve: number
  em_atraso: number
  suspensas: number
  canceladas: number
  mrr_atual: number
  mrr_anterior: number
}

export interface CadastroManualEmpresaInput {
  empresa: {
    nome: string
    nome_fantasia?: string
    cnpj: string
    inscricao_estadual?: string
    inscricao_municipal?: string
    email: string
    telefone?: string
    whatsapp?: string
    cep?: string
    estado?: string
    cidade?: string
    bairro?: string
    endereco?: string
    numero?: string
    complemento?: string
    status?: string
    observacoes?: string
  }
  responsavel: {
    nome: string
    cpf?: string
    email: string
    telefone?: string
    whatsapp?: string
    cargo?: string
  }
  master: {
    nome: string
    email: string
    telefone?: string
    senha: string
    enviar_convite?: boolean
  }
  plano_slug: string
  contratacao: {
    data_contratacao: string
    data_inicio: string
    fim_periodo_teste?: string | null
    proximo_vencimento: string
    valor_contratado: number
    desconto: number
    valor_final: number
    forma_pagamento: string
    periodicidade: string
    status_assinatura: string
    observacoes_comerciais?: string
  }
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

  /**
   * Lista usuários vinculados a uma empresa específica
   */
  async listarUsuarios(empresaId: string): Promise<{ data: AdminUsuarioItem[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, empresa_id, auth_user_id, nome, email, telefone, perfil, ativo, created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: (data as unknown as AdminUsuarioItem[]) || [], error: null }
    } catch (err: any) {
      return { data: [], error: err }
    }
  },

  /**
   * Criação manual completa e transacional de Empresa + Assinatura + Master
   */
  async criarEmpresaManual(
    input: CadastroManualEmpresaInput,
  ): Promise<{
    data: { success: boolean; empresa_id?: string; message?: string } | null
    error: any
  }> {
    try {
      // 1. Chamar RPC transacional para criar Empresa + Assinatura + Logs
      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)(
        'criar_empresa_manual_admin',
        {
          p_empresa: input.empresa,
          p_responsavel: input.responsavel,
          p_master: {
            nome: input.master.nome,
            email: input.master.email,
            senha: input.master.senha,
          },
          p_plano_slug: input.plano_slug,
          p_contratacao: input.contratacao,
        },
      )

      if (rpcErr) throw rpcErr
      const res = rpcRes as any
      if (res && res.success === false) {
        throw new Error(res.error || 'Falha ao registrar empresa.')
      }

      const empresaId = res.empresa_id

      // 2. Chamar Edge Function admin-create-user para criar o usuário Master isolado
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const funcRes = await supabase.functions.invoke('admin-create-user', {
        body: {
          nome: input.master.nome,
          email: input.master.email,
          senha: input.master.senha,
          telefone: input.master.telefone || input.empresa.telefone || '',
          perfil: 'master',
          empresa_id: empresaId,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (funcRes.error || (funcRes.data && funcRes.data.sucesso === false)) {
        // Se a criação do auth user falhar, fazer rollback manual deletando a empresa recém-criada
        try {
          await supabase.from('empresas').delete().eq('id', empresaId)
        } catch {
          // Rollback attempt
        }
        const errorMsg =
          funcRes.data?.erro ||
          funcRes.error?.message ||
          'Falha ao gerar credenciais de acesso do usuário Master.'
        throw new Error(errorMsg)
      }

      return {
        data: {
          success: true,
          empresa_id: empresaId,
          message: 'Empresa e usuário Master criados com sucesso!',
        },
        error: null,
      }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Edição dos dados cadastrais da empresa
   */
  async editarEmpresaCadastral(
    empresaId: string,
    dados: Partial<AdminEmpresaItem>,
  ): Promise<{ data: { success: boolean; message?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('editar_empresa_cadastral_admin', {
        p_empresa_id: empresaId,
        p_dados: dados,
      })
      if (error) throw error
      return { data, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Lista todas as assinaturas detalhadas
   */
  async listarAssinaturas(): Promise<{ data: AdminAssinaturaItem[]; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('listar_assinaturas_admin')
      if (error) throw error
      return { data: (data as unknown as AdminAssinaturaItem[]) || [], error: null }
    } catch (err: any) {
      return { data: [], error: err }
    }
  },

  /**
   * KPIs de assinaturas e MRR
   */
  async getAssinaturasKPIs(): Promise<{ data: AdminAssinaturasKPIs | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_kpis_assinaturas_admin')
      if (error) throw error
      return { data: data as unknown as AdminAssinaturasKPIs, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Ações manuais de controle de assinatura (suspender, reativar, cancelar, estender teste, alterar valores/datas)
   */
  async atualizarAssinaturaManual(
    empresaId: string,
    acao: 'suspender' | 'reativar' | 'cancelar' | 'alterar_dados' | 'estender_teste',
    payload: any,
  ): Promise<{ data: { success: boolean; message?: string } | null; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('atualizar_assinatura_manual_admin', {
        p_empresa_id: empresaId,
        p_acao: acao,
        p_payload: payload,
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        throw new Error(res.error || 'Falha ao atualizar assinatura.')
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Registra pagamento manual de assinatura
   */
  async registrarPagamentoManual(params: {
    empresa_id: string
    valor: number
    data_pagamento: string
    forma_pagamento: string
    competencia?: string
    proximo_vencimento?: string
    referencia?: string
  }): Promise<{
    data: { success: boolean; transacao_id?: string; message?: string } | null
    error: any
  }> {
    try {
      const { data, error } = await (supabase.rpc as any)('registrar_pagamento_manual_admin', {
        p_empresa_id: params.empresa_id,
        p_valor: params.valor,
        p_data_pagamento: params.data_pagamento,
        p_forma_pagamento: params.forma_pagamento,
        p_competencia: params.competencia || '',
        p_proximo_vencimento: params.proximo_vencimento || null,
        p_referencia: params.referencia || '',
      })
      if (error) throw error
      const res = data as any
      if (res && res.success === false) {
        throw new Error(res.error || 'Falha ao registrar pagamento manual.')
      }
      return { data: res, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    }
  },

  /**
   * Lista o histórico de alterações específico de uma empresa
   */
  async listarHistoricoEmpresa(empresaId: string): Promise<{ data: any[]; error: any }> {
    try {
      const { data, error } = await (supabase.rpc as any)('listar_historico_empresa_admin', {
        p_empresa_id: empresaId,
      })
      if (error) throw error
      return { data: (data as any[]) || [], error: null }
    } catch (err: any) {
      return { data: [], error: err }
    }
  },
}
