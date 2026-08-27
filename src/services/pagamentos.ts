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
      const { data, error } = await supabase.functions.invoke<CheckoutPreferenceResponse>(
        'mp-checkout',
        {
          body: {
            plano_slug: planoSlug,
            empresa_id: empresaId,
          },
        },
      )

      if (error) {
        let extractedMessage: string | null = null

        try {
          const ctx = (error as any)?.context
          const body = ctx?.body !== undefined ? ctx.body : ctx

          let rawText: string | null = null
          let parsedData: any = null

          if (body && (body instanceof ReadableStream || typeof body?.getReader === 'function')) {
            rawText = await new Response(body).text()
          } else if (ctx && typeof ctx.text === 'function') {
            rawText = await ctx.text()
          } else if (typeof body === 'string') {
            rawText = body
          } else if (body && typeof body === 'object') {
            parsedData = body
          }

          if (rawText) {
            try {
              parsedData = JSON.parse(rawText)
            } catch {
              extractedMessage = rawText
            }
          }

          if (parsedData && typeof parsedData === 'object') {
            if (typeof parsedData.error === 'string' && parsedData.error.trim()) {
              extractedMessage = parsedData.error.trim()
            } else if (typeof parsedData.message === 'string' && parsedData.message.trim()) {
              extractedMessage = parsedData.message.trim()
            } else if (parsedData.error && typeof parsedData.error.message === 'string') {
              extractedMessage = parsedData.error.message.trim()
            }
          }
        } catch {
          // Silencioso para permitir fallback seguro
        }

        const finalMessage = extractedMessage || error.message || 'Falha ao iniciar pagamento'
        throw new Error(finalMessage)
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      return { data: data ?? null, error: null }
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
