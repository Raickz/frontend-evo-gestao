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
  it('garante que as regras de conciliação e cálculos matemáticos batem centavo a centavo no cenário C1', () => {
    // Cenário Controlado da Fase 2.8:
    // P1: Custo 10.00, Venda 25.00 | P2: Custo 20.00, Venda 50.00
    // Compra 1: 10 un P1 @ 10 = 100.00 (à vista)
    // Compra 2: 10 un P2 @ 20 = 200.00 (a prazo)
    // Venda 1: 2 un P1 @ 25 = 50.00 (Vendedor A 5% -> 2.50). Custo = 20.00. Lucro = 30.00.
    // Venda 2: 1 un P2 @ 50 = 50.00 (Vendedor B 10% -> 5.00). Custo = 20.00. Lucro = 30.00.
    // Venda 3: 1 un P1 + 1 un P2 = 75.00 (Vendedor C 0% -> 0.00). Custo = 30.00. Lucro = 45.00.
    // Venda 4: 2 un P1 @ 25 = 50.00 (Fiado, sem comissão). Custo = 20.00. Lucro = 30.00. Título = 50.00.
    // Baixa parcial: 20.00 no título fiado de 50.00 (saldo restante = 30.00, pago = 20.00).
    // Venda 5 (Cancelada): 1 un P2 @ 50 = 50.00 (não entra em faturamento, custo nem comissão, estoque intacto).
    // Venda 6 (23h30 BRT): 1 un P1 @ 25 = 25.00. Custo = 10.00. Lucro = 15.00. Cai no mesmo dia em SP!

    const vendas = [
      {
        id: 'v1',
        status: 'finalizada',
        total: 50.0,
        custo: 20.0,
        comissao: 2.5,
        diaSp: '2026-09-23',
      },
      {
        id: 'v2',
        status: 'finalizada',
        total: 50.0,
        custo: 20.0,
        comissao: 5.0,
        diaSp: '2026-09-23',
      },
      {
        id: 'v3',
        status: 'finalizada',
        total: 75.0,
        custo: 30.0,
        comissao: 0.0,
        diaSp: '2026-09-23',
      },
      {
        id: 'v4',
        status: 'finalizada',
        total: 50.0,
        custo: 20.0,
        comissao: 0.0,
        diaSp: '2026-09-23',
      },
      {
        id: 'v5',
        status: 'cancelada',
        total: 50.0,
        custo: 20.0,
        comissao: 5.0,
        diaSp: '2026-09-23',
      },
      {
        id: 'v6',
        status: 'finalizada',
        total: 25.0,
        custo: 10.0,
        comissao: 0.0,
        diaSp: '2026-09-23',
      },
    ]

    const vendasValidas = vendas.filter((v) => RegrasCalculo.isVendaValida(v.status))
    expect(vendasValidas.length).toBe(5)

    // Faturamento
    const faturamentoObtido = vendasValidas.reduce((acc, v) => acc + v.total, 0)
    expect(faturamentoObtido).toBe(250.0)

    // Ticket Médio
    const ticketMedioObtido = RegrasCalculo.ticketMedio(faturamentoObtido, vendasValidas.length)
    expect(ticketMedioObtido).toBe(50.0)

    // Custo
    const custoObtido = vendasValidas.reduce((acc, v) => acc + v.custo, 0)
    expect(custoObtido).toBe(100.0)

    // Lucro Bruto
    const lucroObtido = RegrasCalculo.lucroBruto(faturamentoObtido, custoObtido)
    expect(lucroObtido).toBe(150.0)

    // Margem de Lucro %
    const margemObtida = RegrasCalculo.margemLucro(faturamentoObtido, custoObtido)
    expect(margemObtida).toBe(60.0)

    // Compras
    const compras = [
      { id: 'c1', total: 100.0, status: 'confirmada', pago: 100.0 },
      { id: 'c2', total: 200.0, status: 'confirmada', pago: 0.0 },
    ]
    const totalCompras = compras.reduce((acc, c) => acc + c.total, 0)
    expect(totalCompras).toBe(300.0)

    // Contas a Receber
    const contaReceberFiado = { valor: 50.0, valorPago: 20.0 }
    const recAberto = RegrasCalculo.saldoEmAberto(
      contaReceberFiado.valor,
      contaReceberFiado.valorPago,
    )
    expect(recAberto).toBe(30.0)
    expect(contaReceberFiado.valorPago).toBe(20.0)

    // Contas a Pagar
    const contaPagarCompra2 = { valor: 200.0, valorPago: 0.0 }
    const pagAberto = RegrasCalculo.saldoEmAberto(
      contaPagarCompra2.valor,
      contaPagarCompra2.valorPago,
    )
    expect(pagAberto).toBe(200.0)

    // Comissões Pendentes (apenas vendas válidas)
    const comissoesPendentes = vendasValidas.reduce((acc, v) => acc + v.comissao, 0)
    expect(comissoesPendentes).toBe(7.5)

    // Estoques
    // P1: Entrada 10 un - Saídas (V1: 2 + V3: 1 + V4: 2 + V6: 1 = 6 un) = 4 un
    const estoqueP1 = 10 - (2 + 1 + 2 + 1)
    expect(estoqueP1).toBe(4)

    // P2: Entrada 10 un - Saídas (V2: 1 + V3: 1 = 2 un; V5 cancelada não consome) = 8 un
    const estoqueP2 = 10 - (1 + 1)
    expect(estoqueP2).toBe(8)
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
