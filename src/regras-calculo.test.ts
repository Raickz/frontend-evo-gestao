import { describe, it, expect } from 'vitest'
import {
  RegrasCalculo,
  BRAZIL_TIMEZONE,
  converterDiaSaoPauloParaIsoUtc,
  converterPeriodoSaoPauloParaIsoUtc,
  extrairDataSaoPaulo,
  getPresetPeriodoSaoPaulo,
  getAgoraSaoPaulo,
  getHojeSaoPaulo,
  formatAnoMesDia,
} from '@/services/regras-calculo'

describe('Serviço Compartilhado de Cálculo e Fuso Horário (RegrasCalculo)', () => {
  describe('Faturamento e Validação de Vendas', () => {
    it('isVendaValida aceita apenas status "finalizada" (case-insensitive)', () => {
      expect(RegrasCalculo.isVendaValida('finalizada')).toBe(true)
      expect(RegrasCalculo.isVendaValida('Finalizada')).toBe(true)
      expect(RegrasCalculo.isVendaValida('FINALIZADA')).toBe(true)
      expect(RegrasCalculo.isVendaValida('cancelada')).toBe(false)
      expect(RegrasCalculo.isVendaValida('pendente')).toBe(false)
      expect(RegrasCalculo.isVendaValida(null)).toBe(false)
      expect(RegrasCalculo.isVendaValida(undefined)).toBe(false)
      expect(RegrasCalculo.isVendaValida('')).toBe(false)
    })

    it('calcula faturamento excluindo estritamente vendas canceladas ou outras não finalizadas', () => {
      const vendas = [
        { id: '1', status: 'finalizada', total: 150.5 },
        { id: '2', status: 'cancelada', total: 200.0 },
        { id: '3', status: 'finalizada', total: 49.5 },
        { id: '4', status: 'aberta', total: 80.0 },
      ]

      const vendasValidas = vendas.filter((v) => RegrasCalculo.isVendaValida(v.status))
      const faturamento = vendasValidas.reduce((acc, v) => acc + v.total, 0)

      expect(vendasValidas.length).toBe(2)
      expect(faturamento).toBe(200.0)
    })
  })

  describe('Lucro por Custo Histórico e Margem', () => {
    it('calcula lucro bruto corretamente a partir de faturamento e custo histórico', () => {
      // Exemplo: Faturamento R$ 500,00 - Custo Histórico R$ 320,00 = Lucro R$ 180,00
      const lucro = RegrasCalculo.lucroBruto(500, 320)
      expect(lucro).toBe(180)

      // Com casas decimais
      const lucroCentavos = RegrasCalculo.lucroBruto(199.99, 120.5)
      expect(lucroCentavos).toBe(79.49)

      // Custo maior que faturamento gera lucro negativo (prejuízo)
      expect(RegrasCalculo.lucroBruto(100, 150)).toBe(-50)
    })

    it('calcula margem de lucro percentual com precisão e trata faturamento zero', () => {
      // 100 de lucro sobre 200 de faturamento = 50%
      expect(RegrasCalculo.margemLucro(200, 100)).toBe(50)

      // 60 de lucro sobre 250 de faturamento = 24%
      expect(RegrasCalculo.margemLucro(250, 190)).toBe(24)

      // Faturamento zerado retorna 0 sem divisão por zero
      expect(RegrasCalculo.margemLucro(0, 50)).toBe(0)
      expect(RegrasCalculo.margemLucro(-10, 50)).toBe(0)
    })
  })

  describe('Ticket Médio', () => {
    it('calcula ticket médio dividindo faturamento pelo número de vendas válidas', () => {
      expect(RegrasCalculo.ticketMedio(300, 3)).toBe(100)
      expect(RegrasCalculo.ticketMedio(250, 4)).toBe(62.5)
      expect(RegrasCalculo.ticketMedio(100, 3)).toBe(33.33)
    })

    it('retorna 0 para quantidade de vendas menor ou igual a zero', () => {
      expect(RegrasCalculo.ticketMedio(500, 0)).toBe(0)
      expect(RegrasCalculo.ticketMedio(500, -2)).toBe(0)
    })
  })

  describe('Saldo em Aberto (Contas a Pagar / Receber)', () => {
    it('calcula saldo em aberto como valor - valor_pago respeitando centavos', () => {
      expect(RegrasCalculo.saldoEmAberto(100, 40)).toBe(60)
      expect(RegrasCalculo.saldoEmAberto(150.75, 50.25)).toBe(100.5)
      expect(RegrasCalculo.saldoEmAberto(200, 0)).toBe(200)
    })

    it('nunca retorna saldo negativo caso valor_pago seja superior ao valor original', () => {
      expect(RegrasCalculo.saldoEmAberto(100, 120)).toBe(0)
      expect(RegrasCalculo.saldoEmAberto(50, 50)).toBe(0)
    })

    it('trata valores nulos ou indefinidos como zero com segurança', () => {
      expect(RegrasCalculo.saldoEmAberto(undefined as any, 10)).toBe(0)
      expect(RegrasCalculo.saldoEmAberto(100, null as any)).toBe(100)
    })
  })

  describe('Fuso Horário America/Sao_Paulo e Filtros de Data', () => {
    it('usa a constante canonical America/Sao_Paulo', () => {
      expect(BRAZIL_TIMEZONE).toBe('America/Sao_Paulo')
    })

    it('garante que uma venda realizada às 23h30 de Brasília caia no dia civil correto de Brasília', () => {
      // 23h30 BRT do dia 2026-09-23 é 02:30:00 UTC do dia seguinte (2026-09-24T02:30:00.000Z)
      const timestamp23h30BrtEmUtc = '2026-09-24T02:30:00.000Z'
      const dataSp = extrairDataSaoPaulo(timestamp23h30BrtEmUtc)
      expect(dataSp).toBe('2026-09-23')

      // Uma venda realizada às 00h15 BRT do dia 2026-09-24 é 03:15:00 UTC de 2026-09-24
      const timestamp00h15BrtEmUtc = '2026-09-24T03:15:00.000Z'
      expect(extrairDataSaoPaulo(timestamp00h15BrtEmUtc)).toBe('2026-09-24')
    })

    it('converte dia de São Paulo em limites UTC ISO abrangendo das 00:00 às 23:59:59.999 locais', () => {
      const { inicioIso, fimIso } = converterDiaSaoPauloParaIsoUtc('2026-09-23')

      // Em horário padrão de Brasília (UTC-3):
      // 00:00:00 BRT -> 03:00:00.000Z
      // 23:59:59.999 BRT -> 2026-09-24T02:59:59.999Z
      expect(inicioIso).toBe('2026-09-23T03:00:00.000Z')
      expect(fimIso).toBe('2026-09-24T02:59:59.999Z')

      // Ambas as pontas devem ser identificadas no fuso de SP como o mesmo dia
      expect(extrairDataSaoPaulo(inicioIso)).toBe('2026-09-23')
      expect(extrairDataSaoPaulo(fimIso)).toBe('2026-09-23')
    })

    it('converte período de datas para limites adequados para filtros supabase', () => {
      const periodo = {
        inicio: '2026-09-01',
        fim: '2026-09-30',
      }
      const intervalo = converterPeriodoSaoPauloParaIsoUtc(periodo)

      expect(intervalo.inicioIso).toBe('2026-09-01T03:00:00.000Z')
      expect(intervalo.fimIso).toBe('2026-10-01T02:59:59.999Z')
      expect(extrairDataSaoPaulo(intervalo.inicioIso)).toBe('2026-09-01')
      expect(extrairDataSaoPaulo(intervalo.fimIso)).toBe('2026-09-30')
    })

    it('formata ano, mês e dia com padding correto', () => {
      expect(formatAnoMesDia(2026, 9, 5)).toBe('2026-09-05')
      expect(formatAnoMesDia(2026, 12, 25)).toBe('2026-12-25')
    })

    it('gera presets de período válidos no fuso local', () => {
      const presets = [
        'hoje',
        'ontem',
        '7dias',
        '30dias',
        'mes_atual',
        'mes_anterior',
        'ano_atual',
      ] as const
      const hoje = getHojeSaoPaulo()
      const agora = getAgoraSaoPaulo()

      for (const p of presets) {
        const res = getPresetPeriodoSaoPaulo(p)
        expect(res.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(res.fim).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(res.inicio <= res.fim).toBe(true)
      }

      const hojePreset = getPresetPeriodoSaoPaulo('hoje')
      expect(hojePreset.inicio).toBe(hoje)
      expect(hojePreset.fim).toBe(hoje)

      const mesAtual = getPresetPeriodoSaoPaulo('mes_atual')
      expect(mesAtual.inicio).toBe(`${agora.year}-${String(agora.month).padStart(2, '0')}-01`)
      expect(mesAtual.fim).toBe(hoje)
    })
  })
})
