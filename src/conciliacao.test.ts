import { describe, it, expect } from 'vitest'
import { supabase } from '@/lib/supabase/client'
import {
  converterDiaSaoPauloParaIsoUtc,
  converterPeriodoSaoPauloParaIsoUtc,
  extrairDataSaoPaulo,
  getPresetPeriodoSaoPaulo,
  RegrasCalculo,
} from '@/services/regras-calculo'

describe('Teste de Conciliação C1 — Precisão dos Números e Fuso Horário', () => {
  it('garante que a RPC executar_teste_conciliacao_c1 executa e todos os indicadores batem centavo a centavo', async () => {
    const { data, error } = await supabase.rpc('executar_teste_conciliacao_c1' as any)
    if (error) {
      throw new Error(
        `Erro na RPC executar_teste_conciliacao_c1: ${error.message} - ${error.details || ''}`,
      )
    }
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    const indicadores = data as Array<{
      indicador: string
      esperado: any
      obtido: any
      bateu: boolean
    }>

    expect(indicadores.length).toBeGreaterThanOrEqual(14)

    for (const item of indicadores) {
      expect(
        item.bateu,
        `Indicador ${item.indicador} divergiu: esperado=${item.esperado}, obtido=${item.obtido}`,
      ).toBe(true)
    }

    // Exibir no erro proposital os detalhes completos
    expect(JSON.stringify(indicadores)).toBe('FORCE_SHOW_OUTPUT')
  })

  it('valida que uma venda às 23h30 de Brasília permanece no dia correto (America/Sao_Paulo)', () => {
    // 23h30 BRT de 2026-09-23 é 2026-09-24T02:30:00Z
    const timestampVenda23h30Utc = '2026-09-24T02:30:00.000Z'
    const dataExtraida = extrairDataSaoPaulo(timestampVenda23h30Utc)
    expect(dataExtraida).toBe('2026-09-23')

    const limitesHoje = converterDiaSaoPauloParaIsoUtc('2026-09-23')
    expect(timestampVenda23h30Utc >= limitesHoje.inicioIso).toBe(true)
    expect(timestampVenda23h30Utc <= limitesHoje.fimIso).toBe(true)
  })

  it('valida cálculos puros do serviço compartilhado de regras', () => {
    expect(RegrasCalculo.saldoEmAberto(100.5, 30.25)).toBe(70.25)
    expect(RegrasCalculo.lucroBruto(250, 100)).toBe(150)
    expect(RegrasCalculo.margemLucro(250, 100)).toBe(60)
    expect(RegrasCalculo.ticketMedio(250, 5)).toBe(50)
    expect(RegrasCalculo.isVendaValida('finalizada')).toBe(true)
    expect(RegrasCalculo.isVendaValida('cancelada')).toBe(false)
  })
})
