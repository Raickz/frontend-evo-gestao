import { supabase } from '@/lib/supabase/client'

export interface PeriodoFiltro {
  inicio: string // YYYY-MM-DD
  fim: string // YYYY-MM-DD
}

export interface ResumoGeral {
  faturamento: number
  numeroVendas: number
  ticketMedio: number
  totalCompras: number
  valorCompras: number
  contasReceberAberto: number
  contasPagarAberto: number
}

export interface VendaPorDia {
  data: string
  total: number
  quantidade: number
}

export interface ProdutoRanking {
  produto_id: string
  nome: string
  codigo: string | null
  unidade: string
  quantidadeVendida: number
  faturamento: number
  ticketMedio: number
}

export interface VendedorDesempenho {
  vendedor_id: string
  nome: string
  vendas: number
  faturamento: number
  ticketMedio: number
  comissaoTotal: number
}

export interface FormaPagamentoResumo {
  forma_pagamento: string
  quantidade: number
  valor: number
}

export interface ClienteResumo {
  cliente_id: string
  nome: string
  quantidadeCompras: number
  valorTotal: number
  ultimaCompra: string | null
}

export interface CompraFornecedorResumo {
  fornecedor_id: string
  nome: string
  numeroCompras: number
  valorTotal: number
}

export interface ProdutoCompradoResumo {
  produto_id: string
  nome: string
  codigo: string | null
  unidade: string
  quantidadeComprada: number
  valorTotal: number
  custoMedio: number
}

export interface EstoqueIndicadores {
  produtosZerados: number
  produtosAbaixoMinimo: number
  produtosNormais: number
  quantidadeTotalEstoque: number
}

export interface EstoqueItem {
  produto_id: string
  nome: string
  codigo: string | null
  unidade: string
  estoqueAtual: number
  estoqueMinimo: number
  status: 'zerado' | 'abaixo_minimo' | 'normal'
}

export interface MovimentacaoResumo {
  entradas: number
  saidas: number
  perdas: number
  ajustes: number
  devolucoes: number
}

export interface FinanceiroResumo {
  contasReceber: { total: number; recebido: number; aberto: number; vencido: number }
  contasPagar: { total: number; pago: number; aberto: number; vencido: number }
}

export interface FluxoFinanceiroItem {
  mes: string
  recebimentos: number
  pagamentos: number
}

export interface PedidosIndicadores {
  total: number
  pendentes: number
  confirmados: number
  faturados: number
  cancelados: number
  convertidosEmVenda: number
  valorConvertido: number
}

export const RelatoriosService = {
  /**
   * 1. getResumoGeral
   * - Faturamento e Número de Vendas: vendas com status 'finalizada' no período
   * - Compras: total e valor de compras no período (por data_compra)
   * - Contas a Receber em aberto: status != 'pago' AND status != 'cancelado' (saldo atual)
   * - Contas a Pagar em aberto: status != 'pago' AND status != 'cancelado' (saldo atual)
   */
  async getResumoGeral(empresaId: string, periodo: PeriodoFiltro): Promise<ResumoGeral> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const [vendasRes, comprasRes, recRes, pagRes] = await Promise.all([
      supabase
        .from('vendas')
        .select('total')
        .eq('empresa_id', empresaId)
        .eq('status', 'finalizada')
        .gte('created_at', inicioTs)
        .lte('created_at', fimTs),
      supabase
        .from('compras')
        .select('total')
        .eq('empresa_id', empresaId)
        .gte('data_compra', periodo.inicio)
        .lte('data_compra', periodo.fim),
      supabase
        .from('contas_receber')
        .select('valor, valor_pago, status')
        .eq('empresa_id', empresaId)
        .neq('status', 'pago')
        .neq('status', 'cancelado'),
      supabase
        .from('contas_pagar')
        .select('valor, valor_pago, status')
        .eq('empresa_id', empresaId)
        .neq('status', 'pago')
        .neq('status', 'cancelado'),
    ])

    const vendas = vendasRes.data || []
    const numeroVendas = vendas.length
    const faturamento = vendas.reduce((acc, v) => acc + (Number(v.total) || 0), 0)
    const ticketMedio = numeroVendas > 0 ? faturamento / numeroVendas : 0

    const compras = comprasRes.data || []
    const totalCompras = compras.length
    const valorCompras = compras.reduce((acc, c) => acc + (Number(c.total) || 0), 0)

    const contasReceberAberto = (recRes.data || []).reduce((acc, r) => {
      const v = Number(r.valor) || 0
      const p = Number(r.valor_pago) || 0
      return acc + Math.max(0, v - p)
    }, 0)

    const contasPagarAberto = (pagRes.data || []).reduce((acc, p) => {
      const v = Number(p.valor) || 0
      const pg = Number(p.valor_pago) || 0
      return acc + Math.max(0, v - pg)
    }, 0)

    return {
      faturamento,
      numeroVendas,
      ticketMedio,
      totalCompras,
      valorCompras,
      contasReceberAberto,
      contasPagarAberto,
    }
  },

  /**
   * 2. getVendasPorDia
   */
  async getVendasPorDia(empresaId: string, periodo: PeriodoFiltro): Promise<VendaPorDia[]> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const { data } = await supabase
      .from('vendas')
      .select('created_at, total')
      .eq('empresa_id', empresaId)
      .eq('status', 'finalizada')
      .gte('created_at', inicioTs)
      .lte('created_at', fimTs)
      .order('created_at', { ascending: true })

    const grouped: Record<string, { total: number; quantidade: number }> = {}

    for (const v of data || []) {
      const dataStr = v.created_at ? v.created_at.split('T')[0] : ''
      if (!dataStr) continue
      if (!grouped[dataStr]) {
        grouped[dataStr] = { total: 0, quantidade: 0 }
      }
      grouped[dataStr].total += Number(v.total) || 0
      grouped[dataStr].quantidade += 1
    }

    return Object.entries(grouped)
      .map(([dataKey, item]) => ({
        data: dataKey,
        total: item.total,
        quantidade: item.quantidade,
      }))
      .sort((a, b) => a.data.localeCompare(b.data))
  },

  /**
   * 3. getRankingProdutos
   * - Agrupa itens_venda com inner join vendas e produtos
   */
  async getRankingProdutos(
    empresaId: string,
    periodo: PeriodoFiltro,
    ordem: 'quantidade' | 'faturamento' = 'faturamento',
  ): Promise<ProdutoRanking[]> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const { data } = await supabase
      .from('itens_venda')
      .select(
        'produto_id, quantidade, subtotal, vendas!inner(status, created_at), produtos!inner(nome, codigo, unidade)',
      )
      .eq('empresa_id', empresaId)
      .eq('vendas.status', 'finalizada')
      .gte('vendas.created_at', inicioTs)
      .lte('vendas.created_at', fimTs)

    const map = new Map<
      string,
      {
        produto_id: string
        nome: string
        codigo: string | null
        unidade: string
        quantidadeVendida: number
        faturamento: number
      }
    >()

    for (const row of (data as any[]) || []) {
      const pId = row.produto_id
      const pInfo = row.produtos
      const qtd = Number(row.quantidade) || 0
      const sub = Number(row.subtotal) || 0

      const existing = map.get(pId)
      if (existing) {
        existing.quantidadeVendida += qtd
        existing.faturamento += sub
      } else {
        map.set(pId, {
          produto_id: pId,
          nome: pInfo?.nome || 'Produto Sem Nome',
          codigo: pInfo?.codigo || null,
          unidade: pInfo?.unidade || 'UN',
          quantidadeVendida: qtd,
          faturamento: sub,
        })
      }
    }

    const ranking: ProdutoRanking[] = Array.from(map.values()).map((p) => ({
      ...p,
      ticketMedio: p.quantidadeVendida > 0 ? p.faturamento / p.quantidadeVendida : 0,
    }))

    if (ordem === 'quantidade') {
      ranking.sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)
    } else {
      ranking.sort((a, b) => b.faturamento - a.faturamento)
    }

    return ranking.slice(0, 20)
  },

  /**
   * 4. getDesempenhoVendedores
   */
  async getDesempenhoVendedores(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<VendedorDesempenho[]> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const [vendasRes, comissoesRes] = await Promise.all([
      supabase
        .from('vendas')
        .select('id, vendedor_id, total, vendedores!inner(nome)')
        .eq('empresa_id', empresaId)
        .eq('status', 'finalizada')
        .not('vendedor_id', 'is', null)
        .gte('created_at', inicioTs)
        .lte('created_at', fimTs),
      supabase
        .from('comissoes')
        .select('vendedor_id, valor_comissao, vendas!inner(created_at, status)')
        .eq('empresa_id', empresaId)
        .eq('vendas.status', 'finalizada')
        .gte('vendas.created_at', inicioTs)
        .lte('vendas.created_at', fimTs),
    ])

    const mapVendedores = new Map<
      string,
      {
        vendedor_id: string
        nome: string
        vendas: number
        faturamento: number
      }
    >()

    for (const v of (vendasRes.data as any[]) || []) {
      const vId = v.vendedor_id
      const nome = v.vendedores?.nome || 'Vendedor'
      const total = Number(v.total) || 0

      const existing = mapVendedores.get(vId)
      if (existing) {
        existing.vendas += 1
        existing.faturamento += total
      } else {
        mapVendedores.set(vId, {
          vendedor_id: vId,
          nome,
          vendas: 1,
          faturamento: total,
        })
      }
    }

    const mapComissoes = new Map<string, number>()
    for (const c of (comissoesRes.data as any[]) || []) {
      const vId = c.vendedor_id
      const val = Number(c.valor_comissao) || 0
      mapComissoes.set(vId, (mapComissoes.get(vId) || 0) + val)
    }

    const list: VendedorDesempenho[] = Array.from(mapVendedores.values()).map((v) => {
      const comissaoTotal = mapComissoes.get(v.vendedor_id) || 0
      const ticketMedio = v.vendas > 0 ? v.faturamento / v.vendas : 0
      return {
        ...v,
        ticketMedio,
        comissaoTotal,
      }
    })

    list.sort((a, b) => b.faturamento - a.faturamento)
    return list
  },

  /**
   * 5. getFormasPagamento
   */
  async getFormasPagamento(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<FormaPagamentoResumo[]> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const { data } = await supabase
      .from('vendas')
      .select('forma_pagamento, total')
      .eq('empresa_id', empresaId)
      .eq('status', 'finalizada')
      .gte('created_at', inicioTs)
      .lte('created_at', fimTs)

    const map: Record<string, { quantidade: number; valor: number }> = {}

    for (const v of data || []) {
      const fp = v.forma_pagamento || 'outros'
      const total = Number(v.total) || 0
      if (!map[fp]) {
        map[fp] = { quantidade: 0, valor: 0 }
      }
      map[fp].quantidade += 1
      map[fp].valor += total
    }

    return Object.entries(map)
      .map(([forma, item]) => ({
        forma_pagamento: forma,
        quantidade: item.quantidade,
        valor: item.valor,
      }))
      .sort((a, b) => b.valor - a.valor)
  },

  /**
   * 6. getClientesResumo
   */
  async getClientesResumo(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<{
    clientes: ClienteResumo[]
    compraramNoPeriodo: number
    novosNoPeriodo: number
    topCliente: string | null
  }> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const [vendasRes, novosClientesRes] = await Promise.all([
      supabase
        .from('vendas')
        .select('cliente_id, total, created_at, clientes!inner(nome)')
        .eq('empresa_id', empresaId)
        .eq('status', 'finalizada')
        .not('cliente_id', 'is', null)
        .gte('created_at', inicioTs)
        .lte('created_at', fimTs),
      supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .gte('created_at', inicioTs)
        .lte('created_at', fimTs),
    ])

    const map = new Map<
      string,
      {
        cliente_id: string
        nome: string
        quantidadeCompras: number
        valorTotal: number
        ultimaCompra: string | null
      }
    >()

    for (const v of (vendasRes.data as any[]) || []) {
      const cId = v.cliente_id
      const nome = v.clientes?.nome || 'Cliente'
      const total = Number(v.total) || 0
      const dt = v.created_at

      const existing = map.get(cId)
      if (existing) {
        existing.quantidadeCompras += 1
        existing.valorTotal += total
        if (!existing.ultimaCompra || dt > existing.ultimaCompra) {
          existing.ultimaCompra = dt
        }
      } else {
        map.set(cId, {
          cliente_id: cId,
          nome,
          quantidadeCompras: 1,
          valorTotal: total,
          ultimaCompra: dt,
        })
      }
    }

    const list = Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal)
    const compraramNoPeriodo = list.length
    const novosNoPeriodo = novosClientesRes.count || 0
    const topCliente = list.length > 0 ? list[0].nome : null

    return {
      clientes: list.slice(0, 20),
      compraramNoPeriodo,
      novosNoPeriodo,
      topCliente,
    }
  },

  /**
   * 7. getComprasPorFornecedor
   */
  async getComprasPorFornecedor(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<CompraFornecedorResumo[]> {
    const { data } = await supabase
      .from('compras')
      .select('fornecedor_id, total, fornecedores!inner(nome)')
      .eq('empresa_id', empresaId)
      .gte('data_compra', periodo.inicio)
      .lte('data_compra', periodo.fim)

    const map = new Map<
      string,
      { fornecedor_id: string; nome: string; numeroCompras: number; valorTotal: number }
    >()

    for (const c of (data as any[]) || []) {
      const fId = c.fornecedor_id
      const nome = c.fornecedores?.nome || 'Fornecedor'
      const total = Number(c.total) || 0

      const existing = map.get(fId)
      if (existing) {
        existing.numeroCompras += 1
        existing.valorTotal += total
      } else {
        map.set(fId, {
          fornecedor_id: fId,
          nome,
          numeroCompras: 1,
          valorTotal: total,
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal)
  },

  /**
   * 8. getProdutosMaisComprados
   */
  async getProdutosMaisComprados(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<ProdutoCompradoResumo[]> {
    const { data } = await supabase
      .from('itens_compra')
      .select(
        'produto_id, quantidade, subtotal, compras!inner(data_compra, status), produtos!inner(nome, codigo, unidade)',
      )
      .eq('empresa_id', empresaId)
      .gte('compras.data_compra', periodo.inicio)
      .lte('compras.data_compra', periodo.fim)

    const map = new Map<
      string,
      {
        produto_id: string
        nome: string
        codigo: string | null
        unidade: string
        quantidadeComprada: number
        valorTotal: number
      }
    >()

    for (const it of (data as any[]) || []) {
      const pId = it.produto_id
      const pInfo = it.produtos
      const qtd = Number(it.quantidade) || 0
      const sub = Number(it.subtotal) || 0

      const existing = map.get(pId)
      if (existing) {
        existing.quantidadeComprada += qtd
        existing.valorTotal += sub
      } else {
        map.set(pId, {
          produto_id: pId,
          nome: pInfo?.nome || 'Produto',
          codigo: pInfo?.codigo || null,
          unidade: pInfo?.unidade || 'UN',
          quantidadeComprada: qtd,
          valorTotal: sub,
        })
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        custoMedio: item.quantidadeComprada > 0 ? item.valorTotal / item.quantidadeComprada : 0,
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .slice(0, 20)
  },

  /**
   * 9. getEstoqueIndicadores
   */
  async getEstoqueIndicadores(empresaId: string): Promise<EstoqueIndicadores> {
    const { data } = await supabase
      .from('estoques')
      .select('quantidade, produtos!inner(estoque_minimo, ativo)')
      .eq('empresa_id', empresaId)
      .eq('produtos.ativo', true)

    let zerados = 0
    let abaixoMinimo = 0
    let normais = 0
    let quantidadeTotalEstoque = 0

    for (const item of (data as any[]) || []) {
      const qtd = Number(item.quantidade) || 0
      const min = Number(item.produtos?.estoque_minimo) || 0

      quantidadeTotalEstoque += qtd

      if (qtd === 0) {
        zerados++
      } else if (qtd > 0 && qtd <= min) {
        abaixoMinimo++
      } else {
        normais++
      }
    }

    return {
      produtosZerados: zerados,
      produtosAbaixoMinimo: abaixoMinimo,
      produtosNormais: normais,
      quantidadeTotalEstoque,
    }
  },

  /**
   * 10. getEstoqueItens
   */
  async getEstoqueItens(
    empresaId: string,
    statusFilter: 'todos' | 'zerado' | 'abaixo_minimo' = 'todos',
  ): Promise<EstoqueItem[]> {
    const { data } = await supabase
      .from('estoques')
      .select(
        'produto_id, quantidade, produtos!inner(id, nome, codigo, unidade, estoque_minimo, ativo)',
      )
      .eq('empresa_id', empresaId)
      .eq('produtos.ativo', true)
      .order('nome', { foreignTable: 'produtos', ascending: true })

    const list: EstoqueItem[] = []

    for (const item of (data as any[]) || []) {
      const qtd = Number(item.quantidade) || 0
      const min = Number(item.produtos?.estoque_minimo) || 0
      let status: 'zerado' | 'abaixo_minimo' | 'normal' = 'normal'

      if (qtd === 0) {
        status = 'zerado'
      } else if (qtd <= min) {
        status = 'abaixo_minimo'
      }

      if (statusFilter === 'todos' || statusFilter === status) {
        list.push({
          produto_id: item.produto_id,
          nome: item.produtos?.nome || 'Produto',
          codigo: item.produtos?.codigo || null,
          unidade: item.produtos?.unidade || 'UN',
          estoqueAtual: qtd,
          estoqueMinimo: min,
          status,
        })
      }
    }

    return list
  },

  /**
   * 11. getMovimentacoesResumo
   */
  async getMovimentacoesResumo(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<MovimentacaoResumo> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const { data } = await supabase
      .from('movimentacoes_estoque')
      .select('tipo, quantidade')
      .eq('empresa_id', empresaId)
      .gte('created_at', inicioTs)
      .lte('created_at', fimTs)

    const resumo: MovimentacaoResumo = {
      entradas: 0,
      saidas: 0,
      perdas: 0,
      ajustes: 0,
      devolucoes: 0,
    }

    for (const m of data || []) {
      const qtd = Number(m.quantidade) || 0
      const tipo = (m.tipo || '').toLowerCase()
      if (tipo === 'entrada') resumo.entradas += qtd
      else if (tipo === 'saida') resumo.saidas += qtd
      else if (tipo === 'perda') resumo.perdas += qtd
      else if (tipo === 'ajuste') resumo.ajustes += qtd
      else if (tipo === 'devolucao') resumo.devolucoes += qtd
    }

    return resumo
  },

  /**
   * 12. getFinanceiroResumo
   */
  async getFinanceiroResumo(
    empresaId: string,
    _periodo?: PeriodoFiltro,
  ): Promise<FinanceiroResumo> {
    const todayStr = new Date().toISOString().split('T')[0]

    const [recRes, pagRes] = await Promise.all([
      supabase
        .from('contas_receber')
        .select('status, valor, valor_pago, vencimento')
        .eq('empresa_id', empresaId),
      supabase
        .from('contas_pagar')
        .select('status, valor, valor_pago, vencimento')
        .eq('empresa_id', empresaId),
    ])

    const calcIndicadores = (rows: any[]) => {
      let total = 0
      let pagoOuRecebido = 0
      let aberto = 0
      let vencido = 0

      for (const row of rows || []) {
        const v = Number(row.valor) || 0
        const p = Number(row.valor_pago) || 0
        const saldo = Math.max(0, v - p)
        const venc = row.vencimento ? row.vencimento.split('T')[0] : ''

        if (row.status !== 'cancelado') {
          total += v
        }
        pagoOuRecebido += p

        if (row.status !== 'pago' && row.status !== 'cancelado') {
          aberto += saldo
          if (row.status === 'atrasado' || (venc && venc < todayStr)) {
            vencido += saldo
          }
        }
      }

      return { total, recebidoOuPago: pagoOuRecebido, aberto, vencido }
    }

    const rec = calcIndicadores(recRes.data || [])
    const pag = calcIndicadores(pagRes.data || [])

    return {
      contasReceber: {
        total: rec.total,
        recebido: rec.recebidoOuPago,
        aberto: rec.aberto,
        vencido: rec.vencido,
      },
      contasPagar: {
        total: pag.total,
        pago: pag.recebidoOuPago,
        aberto: pag.aberto,
        vencido: pag.vencido,
      },
    }
  },

  /**
   * 13. getFluxoFinanceiro
   */
  async getFluxoFinanceiro(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<FluxoFinanceiroItem[]> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const [recRes, pagRes] = await Promise.all([
      supabase
        .from('contas_receber')
        .select('valor_pago, data_pagamento')
        .eq('empresa_id', empresaId)
        .gt('valor_pago', 0)
        .gte('data_pagamento', inicioTs)
        .lte('data_pagamento', fimTs),
      supabase
        .from('contas_pagar')
        .select('valor_pago, data_pagamento')
        .eq('empresa_id', empresaId)
        .gt('valor_pago', 0)
        .gte('data_pagamento', inicioTs)
        .lte('data_pagamento', fimTs),
    ])

    const mesesMap: Record<string, { recebimentos: number; pagamentos: number }> = {}

    for (const r of recRes.data || []) {
      const mes = r.data_pagamento ? r.data_pagamento.substring(0, 7) : ''
      if (!mes) continue
      if (!mesesMap[mes]) {
        mesesMap[mes] = { recebimentos: 0, pagamentos: 0 }
      }
      mesesMap[mes].recebimentos += Number(r.valor_pago) || 0
    }

    for (const p of pagRes.data || []) {
      const mes = p.data_pagamento ? p.data_pagamento.substring(0, 7) : ''
      if (!mes) continue
      if (!mesesMap[mes]) {
        mesesMap[mes] = { recebimentos: 0, pagamentos: 0 }
      }
      mesesMap[mes].pagamentos += Number(p.valor_pago) || 0
    }

    return Object.entries(mesesMap)
      .map(([mes, item]) => ({
        mes,
        recebimentos: item.recebimentos,
        pagamentos: item.pagamentos,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  },

  /**
   * 14. getPedidosIndicadores
   */
  async getPedidosIndicadores(
    empresaId: string,
    periodo: PeriodoFiltro,
  ): Promise<PedidosIndicadores> {
    const inicioTs = `${periodo.inicio}T00:00:00.000Z`
    const fimTs = `${periodo.fim}T23:59:59.999Z`

    const [pedidosRes, vendasConvertidasRes] = await Promise.all([
      supabase
        .from('pedidos')
        .select('status')
        .eq('empresa_id', empresaId)
        .gte('created_at', inicioTs)
        .lte('created_at', fimTs),
      supabase
        .from('vendas')
        .select('id, total, pedido_id, pedidos!inner(created_at)')
        .eq('empresa_id', empresaId)
        .not('pedido_id', 'is', null)
        .gte('pedidos.created_at', inicioTs)
        .lte('pedidos.created_at', fimTs),
    ])

    const pedidos = pedidosRes.data || []
    let pendentes = 0
    let confirmados = 0
    let faturados = 0
    let cancelados = 0

    for (const p of pedidos) {
      const st = (p.status || '').toLowerCase()
      if (st === 'pendente') pendentes++
      else if (st === 'confirmado') confirmados++
      else if (st === 'faturado') faturados++
      else if (st === 'cancelado') cancelados++
    }

    const vendasConvertidas = (vendasConvertidasRes.data as any[]) || []
    const convertidosEmVenda = vendasConvertidas.length
    const valorConvertido = vendasConvertidas.reduce((acc, v) => acc + (Number(v.total) || 0), 0)

    return {
      total: pedidos.length,
      pendentes,
      confirmados,
      faturados,
      cancelados,
      convertidosEmVenda,
      valorConvertido,
    }
  },
}
