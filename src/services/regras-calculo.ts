/**
 * EVO GESTÃO — FONTE ÚNICA DE REGRAS DE CÁLCULO E FUSO HORÁRIO (RODADA C1)
 *
 * DEFINIÇÕES PADRÃO DO SISTEMA:
 *
 * 1. FUSO HORÁRIO PADRÃO:
 *    - Fuso canônico: "America/Sao_Paulo" (UTC-3 / Horário de Brasília).
 *    - Todos os limites de datas ("hoje", "ontem", "últimos 7 dias", "este mês", "mês anterior")
 *      são calculados estritamente na perspectiva de Brasília e convertidos em timestamps ISO UTC
 *      exatos: início do dia (00:00:00.000 BRT -> 03:00:00.000Z) e fim do dia (23:59:59.999 BRT -> 02:59:59.999Z do dia seguinte).
 *    - Uma venda realizada às 22h ou 23h30 de Brasília permanece no dia correto de Brasília.
 *
 * 2. VENDA VÁLIDA:
 *    - Venda com status = 'finalizada' (exclui estritamente status = 'cancelada' ou outros).
 *
 * 3. FATURAMENTO BRUTO:
 *    - Soma de venda.total (ou subtotal dos itens) para todas as vendas válidas (finalizadas) no período.
 *
 * 4. CUSTO HISTÓRICO:
 *    - Soma de (quantidade * custo_unitario) registrada em itens_venda na finalização da venda.
 *    - Se uma venda for antiga sem custo histórico, recorre ao preco_custo cadastrado no produto.
 *
 * 5. LUCRO BRUTO:
 *    - Faturamento Bruto - Custo Histórico dos Produtos.
 *
 * 6. MARGEM DE LUCRO:
 *    - Se faturamento > 0: (Lucro Bruto / Faturamento) * 100.
 *
 * 7. TICKET MÉDIO:
 *    - Se quantidade de vendas válidas > 0: Faturamento / quantidade de vendas válidas.
 *
 * 8. CONTAS A RECEBER / A PAGAR EM ABERTO (SALDO):
 *    - Títulos não cancelados (status != 'cancelado') e não quitados (status != 'pago').
 *    - Saldo em aberto = Math.max(0, valor - valor_pago).
 *    - Título Vencido: Saldo em aberto onde status = 'atrasado' ou vencimento < data_atual_brasilia.
 *    - Título A Vencer: Saldo em aberto onde vencimento >= data_atual_brasilia e status = 'pendente'.
 *
 * 9. COMISSÕES:
 *    - Registros de comissões com status != 'cancelada'.
 *    - Pendentes: status = 'pendente'.
 *    - Pagas: status = 'pago'.
 */

export const BRAZIL_TIMEZONE = 'America/Sao_Paulo'

export interface IntervaloUtcIso {
  inicioIso: string
  fimIso: string
}

export interface PeriodoDatas {
  inicio: string // YYYY-MM-DD em America/Sao_Paulo
  fim: string // YYYY-MM-DD em America/Sao_Paulo
}

/**
 * Retorna a data e hora atual no fuso America/Sao_Paulo como componentes numéricos
 */
export function getAgoraSaoPaulo(): {
  year: number
  month: number // 1 a 12
  day: number
  hour: number
  minute: number
  second: number
  dateStr: string // YYYY-MM-DD
} {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Format en-CA yields "YYYY-MM-DD, HH:mm:ss" or similar
  const parts = formatter.formatToParts(now)
  const partMap: Record<string, string> = {}
  for (const p of parts) {
    partMap[p.type] = p.value
  }

  const year = parseInt(partMap.year, 10)
  const month = parseInt(partMap.month, 10)
  const day = parseInt(partMap.day, 10)
  const hour = parseInt(partMap.hour, 10)
  const minute = parseInt(partMap.minute, 10)
  const second = parseInt(partMap.second, 10)

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`

  return { year, month, day, hour, minute, second, dateStr }
}

/**
 * Retorna a data 'hoje' em America/Sao_Paulo no formato YYYY-MM-DD
 */
export function getHojeSaoPaulo(): string {
  return getAgoraSaoPaulo().dateStr
}

/**
 * Converte uma data string YYYY-MM-DD para objeto Date com componentes seguros
 */
function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10))
  return { year: y, month: m, day: d }
}

/**
 * Formata um ano, mês e dia para string YYYY-MM-DD
 */
export function formatAnoMesDia(year: number, month: number, day: number): string {
  const yStr = String(year).padStart(4, '0')
  const mStr = String(month).padStart(2, '0')
  const dStr = String(day).padStart(2, '0')
  return `${yStr}-${mStr}-${dStr}`
}

/**
 * Converte um dia de calendário em America/Sao_Paulo (ex: "2026-09-23")
 * para os limites exatos em UTC ISO com início (00:00:00.000) e fim (23:59:59.999).
 *
 * Como o horário padrão de Brasília é UTC-3 (sem horário de verão atual):
 * - Início: YYYY-MM-DDT03:00:00.000Z
 * - Fim: YYYY-MM-(D+1)T02:59:59.999Z
 *
 * Para total robustez diante de transições, calculamos via Date UTC:
 */
export function converterDiaSaoPauloParaIsoUtc(dateStr: string): {
  inicioIso: string
  fimIso: string
} {
  const { year, month, day } = parseDateParts(dateStr)

  // Criamos a data assumindo meio-dia UTC para encontrar o offset exato de SP naquele dia
  const refUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const tzOffsetMinutes = getTimezoneOffsetSaoPaulo(refUtc) // Em SP é tipicamente -180 min (-3h)

  // 00:00:00 em SP = 00:00:00 - tzOffset
  const inicioMillis = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000
  const fimMillis = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000

  return {
    inicioIso: new Date(inicioMillis).toISOString(),
    fimIso: new Date(fimMillis).toISOString(),
  }
}

/**
 * Converte um intervalo [dataInicio, dataFim] (YYYY-MM-DD) em America/Sao_Paulo
 * para timestamps ISO UTC limites adequados para filtros supabase .gte('created_at', inicioIso) e .lte('created_at', fimIso).
 */
export function converterPeriodoSaoPauloParaIsoUtc(periodo: PeriodoDatas): IntervaloUtcIso {
  const inicio = converterDiaSaoPauloParaIsoUtc(periodo.inicio).inicioIso
  const fim = converterDiaSaoPauloParaIsoUtc(periodo.fim).fimIso
  return { inicioIso: inicio, fimIso: fim }
}

/**
 * Obtém o offset em minutos de America/Sao_Paulo para uma data específica (normalmente -180)
 */
function getTimezoneOffsetSaoPaulo(date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const spDate = new Date(date.toLocaleString('en-US', { timeZone: BRAZIL_TIMEZONE }))
  return Math.round((spDate.getTime() - utcDate.getTime()) / 60000)
}

/**
 * Converte qualquer timestamp UTC (ex: "2026-09-23T23:30:00Z") para a data local YYYY-MM-DD em America/Sao_Paulo
 */
export function extrairDataSaoPaulo(timestampIsoOuDate: string | Date | null | undefined): string {
  if (!timestampIsoOuDate) return ''
  const d =
    typeof timestampIsoOuDate === 'string' ? new Date(timestampIsoOuDate) : timestampIsoOuDate
  if (isNaN(d.getTime())) return ''

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Retorna os limites YYYY-MM-DD no fuso America/Sao_Paulo para presets comuns:
 * - 'hoje': dia atual em SP
 * - 'ontem': dia anterior em SP
 * - '7dias': hoje - 6 dias até hoje
 * - '30dias': hoje - 29 dias até hoje
 * - 'mes_atual': 1º dia do mês corrente até hoje
 * - 'mes_anterior': 1º dia ao último dia do mês anterior
 * - 'ano_atual': 1º de janeiro do ano atual até hoje
 */
export function getPresetPeriodoSaoPaulo(
  preset: 'hoje' | 'ontem' | '7dias' | '30dias' | 'mes_atual' | 'mes_anterior' | 'ano_atual',
): PeriodoDatas {
  const agora = getAgoraSaoPaulo()
  const hojeStr = agora.dateStr

  switch (preset) {
    case 'hoje':
      return { inicio: hojeStr, fim: hojeStr }

    case 'ontem': {
      const ontemDate = new Date(Date.UTC(agora.year, agora.month - 1, agora.day - 1))
      const inicio = formatAnoMesDia(
        ontemDate.getUTCFullYear(),
        ontemDate.getUTCMonth() + 1,
        ontemDate.getUTCDate(),
      )
      return { inicio, fim: inicio }
    }

    case '7dias': {
      const d = new Date(Date.UTC(agora.year, agora.month - 1, agora.day - 6))
      const inicio = formatAnoMesDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      return { inicio, fim: hojeStr }
    }

    case '30dias': {
      const d = new Date(Date.UTC(agora.year, agora.month - 1, agora.day - 29))
      const inicio = formatAnoMesDia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      return { inicio, fim: hojeStr }
    }

    case 'mes_atual': {
      const inicio = formatAnoMesDia(agora.year, agora.month, 1)
      return { inicio, fim: hojeStr }
    }

    case 'mes_anterior': {
      // 1º dia do mês anterior
      const primeiroDiaAnt = new Date(Date.UTC(agora.year, agora.month - 2, 1))
      // Último dia do mês anterior = dia 0 do mês atual
      const ultimoDiaAnt = new Date(Date.UTC(agora.year, agora.month - 1, 0))
      return {
        inicio: formatAnoMesDia(
          primeiroDiaAnt.getUTCFullYear(),
          primeiroDiaAnt.getUTCMonth() + 1,
          primeiroDiaAnt.getUTCDate(),
        ),
        fim: formatAnoMesDia(
          ultimoDiaAnt.getUTCFullYear(),
          ultimoDiaAnt.getUTCMonth() + 1,
          ultimoDiaAnt.getUTCDate(),
        ),
      }
    }

    case 'ano_atual': {
      const inicio = formatAnoMesDia(agora.year, 1, 1)
      return { inicio, fim: hojeStr }
    }
  }
}

/**
 * REGRAS DE CÁLCULO PADRÃO COMPARTILHADAS (PURAS)
 */
export const RegrasCalculo = {
  /**
   * Verifica se uma venda é válida para fins de faturamento e relatórios
   */
  isVendaValida(status: string | null | undefined): boolean {
    return (status || '').toLowerCase() === 'finalizada'
  },

  /**
   * Saldo em aberto de um título (a receber ou a pagar)
   */
  saldoEmAberto(valor: number, valorPago: number): number {
    const v = Number(valor) || 0
    const p = Number(valorPago) || 0
    return Math.max(0, Math.round((v - p) * 100) / 100)
  },

  /**
   * Lucro bruto = Faturamento - Custo
   */
  lucroBruto(faturamento: number, custo: number): number {
    return Math.round((faturamento - custo) * 100) / 100
  },

  /**
   * Margem de lucro em percentual (0 a 100)
   */
  margemLucro(faturamento: number, custo: number): number {
    if (faturamento <= 0) return 0
    const lucro = faturamento - custo
    return Math.round((lucro / faturamento) * 100 * 100) / 100
  },

  /**
   * Ticket médio = Faturamento / quantidade de vendas
   */
  ticketMedio(faturamento: number, quantidadeVendas: number): number {
    if (quantidadeVendas <= 0) return 0
    return Math.round((faturamento / quantidadeVendas) * 100) / 100
  },
}
