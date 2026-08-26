import { supabase } from '@/lib/supabase/client'

export interface Transacao {
  id: string
  empresa_id: string
  empresa_nome?: string
  empresa_nome_fantasia?: string
  assinatura_id?: string | null
  plano_id?: string | null
  plano_nome?: string | null
  plano_slug?: string | null
  valor: number
  gateway: string
  gateway_id?: string | null
  gateway_status?: string | null
  metodo_pagamento?: string | null
  status: 'pendente' | 'aprovado' | 'recusado' | 'reembolsado' | 'cancelado' | string
  external_reference?: string | null
  metadata?: Record<string, any>
  created_at: string
  updated_at?: string
}

export interface CheckoutPreferenceResponse {
  id?: string
  init_point: string
  sandbox_init_point?: string
  external_reference?: string
  plano?: {
    id: string
    nome: string
    valor: number
  }
  simulated?: boolean
  error?: string
}

export interface HistoricoFinanceiroAdmin {
  total_recebido: number
  total_pendente: number
  total_recusado: number
  transacoes: Transacao[]
}

export const PagamentosService = {
  /**
   * Inicia o checkout chamando a edge function mp-checkout
   * (Resolve permissão, token de usuário e gera a preferência do Mercado Pago)
   */
  async criarCheckout(
    planoSlug: string,
    empresaId?: string,
  ): Promise<{ data: CheckoutPreferenceResponse | null; error: Error | null }> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (supabaseAnonKey) {
        headers['apikey'] = supabaseAnonKey
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/mp-checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plano_slug: planoSlug,
          empresa_id: empresaId,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao gerar checkout com Mercado Pago.')
      }

      return { data, error: null }
    } catch (err: any) {
      console.error('PagamentosService.criarCheckout:', err)
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
    }
  },

  /**
   * Lista o histórico de transações da empresa logada
   */
  async listMinhasTransacoes(): Promise<{ data: Transacao[] | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase as any)
        .from('transacoes')
        .select(`
          id,
          empresa_id,
          assinatura_id,
          plano_id,
          valor,
          gateway,
          gateway_id,
          gateway_status,
          metodo_pagamento,
          status,
          external_reference,
          created_at,
          updated_at,
          planos (
            id,
            nome,
            slug
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted: Transacao[] = (data || []).map((item: any) => ({
        id: item.id,
        empresa_id: item.empresa_id,
        assinatura_id: item.assinatura_id,
        plano_id: item.plano_id,
        plano_nome: item.planos?.nome || null,
        plano_slug: item.planos?.slug || null,
        valor: Number(item.valor || 0),
        gateway: item.gateway,
        gateway_id: item.gateway_id,
        gateway_status: item.gateway_status,
        metodo_pagamento: item.metodo_pagamento,
        status: item.status,
        external_reference: item.external_reference,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))

      return { data: formatted, error: null }
    } catch (err: any) {
      console.error('PagamentosService.listMinhasTransacoes:', err)
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
    }
  },

  /**
   * Busca métricas financeiras globais para Platform Admin via RPC
   */
  async getHistoricoFinanceiroAdmin(): Promise<{
    data: HistoricoFinanceiroAdmin | null
    error: Error | null
  }> {
    try {
      const { data, error } = await (supabase as any).rpc('get_historico_financeiro_admin')
      if (error) throw error
      return { data: data as unknown as HistoricoFinanceiroAdmin, error: null }
    } catch (err: any) {
      console.error('PagamentosService.getHistoricoFinanceiroAdmin:', err)
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
    }
  },

  /**
   * Valida permissão e dados para checkout via RPC no banco
   */
  async validarCriarCheckout(
    planoSlug: string,
  ): Promise<{ data: any | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase as any).rpc('criar_checkout', {
        p_plano_slug: planoSlug,
      })
      if (error) throw error
      return { data, error: null }
    } catch (err: any) {
      console.error('PagamentosService.validarCriarCheckout:', err)
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
    }
  },
}
