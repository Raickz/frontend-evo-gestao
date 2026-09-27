/**
 * Devedores Service - Rodada Andrade 2
 * Gerenciamento de clientes com contas a receber em aberto, atrasos,
 * recebimentos com comprovante e links de cobrança no WhatsApp.
 */

import { supabase } from '@/lib/supabase/client'

export interface DevedorClienteItem {
  cliente_id: string
  cliente_nome: string
  cliente_telefone: string | null
  cliente_whatsapp: string | null
  cliente_documento: string | null
  limite_credito: number | null
  total_devido: number
  total_vencido: number
  maior_atraso_dias: number
  proxima_parcela_data: string | null
  proxima_parcela_valor: number
  total_parcelas_abertas: number
  total_parcelas_vencidas: number
}

export interface DevedorParcelaItem {
  id: string
  venda_id: string | null
  descricao: string
  numero_parcela: string | null
  valor: number
  valor_pago: number
  saldo: number
  vencimento: string
  data_pagamento: string | null
  forma_pagamento_baixa: string | null
  status: string
  atrasada: boolean
  dias_atraso: number
  venda_numero?: number | null
}

export interface DevedorClienteDetalhes {
  cliente: {
    id: string
    nome: string
    telefone: string | null
    whatsapp: string | null
    documento: string | null
    limite_credito: number | null
    endereco: string | null
    numero: string | null
    bairro: string | null
    cidade: string | null
  }
  total_devido: number
  total_vencido: number
  maior_atraso_dias: number
  parcelas: DevedorParcelaItem[]
}

export interface ComprovanteRecebimentoData {
  conta_id: string
  cliente_nome: string
  cliente_telefone?: string | null
  descricao: string
  parcela?: string | null
  valor_recebido: number
  valor_pago_acumulado: number
  saldo_restante: number
  forma_pagamento: string
  data_pagamento: string
  data_hora_emissao: string
}

export const DevedoresService = {
  /**
   * Lista todos os devedores da empresa com filtros e busca
   */
  async listarDevedores(
    filtro: 'todos' | 'vencidos' | 'vencendo_7_dias' = 'todos',
    busca?: string,
  ) {
    const { data, error } = await (supabase.rpc as any)('listar_devedores', {
      p_filtro: filtro,
      p_busca: busca || null,
    })
    return { data: (data || []) as DevedorClienteItem[], error }
  },

  /**
   * Detalha um cliente devedor com todas as suas parcelas e totais
   */
  async detalharCliente(clienteId: string) {
    const { data, error } = await (supabase.rpc as any)('detalhar_devedor_cliente', {
      p_cliente_id: clienteId,
    })
    return { data: data as DevedorClienteDetalhes | null, error }
  },

  /**
   * Registra recebimento total ou parcial de uma parcela
   */
  async registrarRecebimento(
    contaId: string,
    valorRecebido: number,
    formaPagamento: string = 'dinheiro',
    dataPagamento?: string,
  ) {
    const { data, error } = await (supabase.rpc as any)('registrar_recebimento', {
      p_conta_id: contaId,
      p_valor_recebido: valorRecebido,
      p_data_pagamento: dataPagamento || undefined,
      p_forma_pagamento: formaPagamento,
    })
    return { data, error }
  },

  /**
   * Monta o link do WhatsApp com mensagem pronta de cobrança
   */
  gerarLinkWhatsApp(
    cliente: { nome: string; telefone?: string | null; whatsapp?: string | null },
    totalDevido: number,
    totalVencido: number,
    parcelasVencidasCount: number,
    empresaNome: string,
  ) {
    const rawPhone = (cliente.whatsapp || cliente.telefone || '').replace(/\D/g, '')
    if (!rawPhone) return null

    // Garantir prefixo 55 do Brasil se necessário
    const formattedPhone = rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone

    let msg = `Olá, ${cliente.nome.split(' ')[0]}! Tudo bem?\n`
    msg += `Aqui é da *${empresaNome}*.\n\n`
    msg += `Entramos em contato para verificar seu saldo pendente no valor de *R$ ${totalDevido.toFixed(2).replace('.', ',')}*.\n`

    if (totalVencido > 0) {
      msg += `Constatamos *${parcelasVencidasCount} parcela(s) em atraso*, totalizando *R$ ${totalVencido.toFixed(2).replace('.', ',')}*.\n\n`
    } else {
      msg += `Aviso amigável sobre suas próximas parcelas em aberto.\n\n`
    }

    msg += `Podemos enviar a chave PIX ou verificar a melhor forma para você quitar ou regularizar hoje? Obrigado!`

    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`
  },
}
