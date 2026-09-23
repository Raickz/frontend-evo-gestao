import { supabase } from '@/lib/supabase/client'
import {
  converterPeriodoSaoPauloParaIsoUtc,
  RegrasCalculo,
  PeriodoDatas,
} from '@/services/regras-calculo'

export interface PeriodoFiltro {
  inicio: string // YYYY-MM-DD
  fim: string // YYYY-MM-DD
}

export interface LucroResumo {
  faturamento: number
  custoProdutos: number
  lucroBruto: number
  margemPercentual: number
  numeroVendas: number
  ticketMedio: number
}

export interface LucroPorVendedor {
  vendedorId: string
  nome: string
  numeroVendas: number
  faturamento: number
  custo: number
  lucro: number
  margem: number
}

interface RawItemVendaRow {
  quantidade: number
  subtotal: number
  custo_unitario: number
  vendas: {
    id: string
    total: number
    created_at: string
    status: string
    vendedor_id: string | null
  } | null
}

interface RawItemVendaPorVendedorRow {
  quantidade: number
  subtotal: number
  custo_unitario: number
  vendas: {
    id: string
    total: number
    created_at: string
    status: string
    vendedor_id: string | null
    vendedores: {
      id: string
      nome: string
    } | null
  } | null
}

export const RelatorioLucroService = {
  async getResumo(
    empresaId: string,
    periodo: PeriodoFiltro,
    vendedorId?: string | null,
  ): Promise<LucroResumo> {
    const { inicioIso, fimIso } = converterPeriodoSaoPauloParaIsoUtc(periodo)

    let query = supabase
      .from('itens_venda')
      .select(
        'quantidade, subtotal, custo_unitario, vendas!inner(id, total, created_at, status, vendedor_id)',
      )
      .eq('empresa_id', empresaId)
      .eq('vendas.status', 'finalizada')
      .gte('vendas.created_at', inicioIso)
      .lte('vendas.created_at', fimIso)

    if (vendedorId && vendedorId !== 'todos') {
      query = query.eq('vendas.vendedor_id', vendedorId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const rows = (data || []) as unknown as RawItemVendaRow[]

    let faturamento = 0
    let custoProdutos = 0
    const vendasUnicas = new Set<string>()

    for (const item of rows) {
      const subtotalItem = Number(item.subtotal || 0)
      const quantidade = Number(item.quantidade || 0)

      faturamento += subtotalItem
      custoProdutos += quantidade * Number(item.custo_unitario || 0)

      if (item.vendas?.id) {
        vendasUnicas.add(item.vendas.id)
      }
    }

    const numeroVendas = vendasUnicas.size
    const faturamentoArredondado = Math.round(faturamento * 100) / 100
    const custoArredondado = Math.round(custoProdutos * 100) / 100
    const lucroBruto = RegrasCalculo.lucroBruto(faturamentoArredondado, custoArredondado)
    const margemPercentual = RegrasCalculo.margemLucro(faturamentoArredondado, custoArredondado)
    const ticketMedio = RegrasCalculo.ticketMedio(faturamentoArredondado, numeroVendas)

    return {
      faturamento: faturamentoArredondado,
      custoProdutos: custoArredondado,
      lucroBruto,
      margemPercentual,
      numeroVendas,
      ticketMedio,
    }
  },

  async getPorVendedor(empresaId: string, periodo: PeriodoFiltro): Promise<LucroPorVendedor[]> {
    const { inicioIso, fimIso } = converterPeriodoSaoPauloParaIsoUtc(periodo)

    const query = supabase
      .from('itens_venda')
      .select(
        'quantidade, subtotal, custo_unitario, vendas!inner(id, total, created_at, status, vendedor_id, vendedores(id, nome))',
      )
      .eq('empresa_id', empresaId)
      .eq('vendas.status', 'finalizada')
      .gte('vendas.created_at', inicioIso)
      .lte('vendas.created_at', fimIso)

    const { data, error } = await query

    if (error) {
      throw error
    }

    const rows = (data || []) as unknown as RawItemVendaPorVendedorRow[]

    // Agrupar por vendedor_id
    const grouped = new Map<
      string,
      {
        vendedorId: string
        nome: string
        faturamento: number
        custo: number
        vendasSet: Set<string>
      }
    >()

    for (const item of rows) {
      const vendId = item.vendas?.vendedor_id || 'sem_vendedor'
      const vendNome =
        item.vendas?.vendedores?.nome || (item.vendas?.vendedor_id ? 'Vendedor' : 'Sem vendedor')

      if (!grouped.has(vendId)) {
        grouped.set(vendId, {
          vendedorId: vendId,
          nome: vendNome,
          faturamento: 0,
          custo: 0,
          vendasSet: new Set<string>(),
        })
      }

      const g = grouped.get(vendId)!
      const subtotalItem = Number(item.subtotal || 0)
      const quantidade = Number(item.quantidade || 0)

      g.faturamento += subtotalItem
      g.custo += quantidade * Number(item.custo_unitario || 0)

      if (item.vendas?.id) {
        g.vendasSet.add(item.vendas.id)
      }
    }

    const resultado: LucroPorVendedor[] = Array.from(grouped.values()).map((g) => {
      const numeroVendas = g.vendasSet.size
      const faturamento = Math.round(g.faturamento * 100) / 100
      const custo = Math.round(g.custo * 100) / 100
      const lucro = RegrasCalculo.lucroBruto(faturamento, custo)
      const margem = RegrasCalculo.margemLucro(faturamento, custo)

      return {
        vendedorId: g.vendedorId,
        nome: g.nome,
        numeroVendas,
        faturamento,
        custo,
        lucro,
        margem,
      }
    })

    // Ordenar por Lucro DESC
    resultado.sort((a, b) => b.lucro - a.lucro)

    return resultado
  },
}
