import { supabase } from '@/lib/supabase/client'

export interface CestaItem {
  id: string
  nome: string
  codigo: string | null
  preco_venda: number
  preco_custo: number
  ativo: boolean
  estoque_atual: number
  quantidade_reservada: number
  composicao_ativa?: {
    id: string
    versao: number
    custo_adicional: number
    observacoes: string | null
    itens: Array<{
      id: string
      componente_produto_id: string
      quantidade: number
      unidade: string
      componente: {
        id: string
        nome: string
        preco_custo: number
        unidade: string
      }
    }>
  } | null
}

export interface CestaComposicaoItemInput {
  componente_produto_id: string
  quantidade: number
  unidade?: string
}

export interface SalvarComposicaoInput {
  cesta_produto_id: string
  custo_adicional: number
  itens: CestaComposicaoItemInput[]
  observacoes?: string | null
}

export interface OrdemMontagemItem {
  id: string
  empresa_id: string
  numero: number
  cesta_produto_id: string
  composicao_versao_id: string
  quantidade_planejada: number
  quantidade_produzida: number
  status: 'planejada' | 'concluida' | 'cancelada'
  responsavel_usuario_id: string | null
  data_montagem: string
  observacoes: string | null
  custo_unitario_efetivo: number
  created_at: string
  cesta?: {
    id: string
    nome: string
    preco_venda: number
  }
  composicao?: {
    id: string
    versao: number
    custo_adicional: number
  }
  responsavel?: {
    id: string
    nome: string
  }
}

export const CestasService = {
  /**
   * Lista todas as cestas da empresa com saldo atual e composição ativa
   */
  async listCestas(empresaId: string, search?: string) {
    let query = supabase
      .from('produtos')
      .select(`
        id,
        nome,
        codigo,
        preco_venda,
        preco_custo,
        ativo,
        estoques (
          quantidade,
          quantidade_reservada
        ),
        cesta_composicoes (
          id,
          versao,
          ativa,
          custo_adicional,
          observacoes,
          cesta_composicao_itens (
            id,
            componente_produto_id,
            quantidade,
            unidade,
            componente:produtos!cesta_composicao_itens_componente_produto_id_fkey (
              id,
              nome,
              preco_custo,
              unidade
            )
          )
        )
      `)
      .eq('empresa_id', empresaId)
      .eq('tipo_item', 'cesta')

    if (search && search.trim()) {
      const clean = search.trim()
      query = query.or(`nome.ilike.%${clean}%,codigo.ilike.%${clean}%`)
    }

    const { data, error } = await query.order('nome', { ascending: true })
    if (error) throw error

    const mapped: CestaItem[] = (data || []).map((p: any) => {
      const est = p.estoques?.[0] || { quantidade: 0, quantidade_reservada: 0 }
      const composicoes = p.cesta_composicoes || []
      const compAtiva = composicoes.find((c: any) => c.ativa === true) || null

      return {
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        preco_venda: Number(p.preco_venda || 0),
        preco_custo: Number(p.preco_custo || 0),
        ativo: Boolean(p.ativo),
        estoque_atual: Number(est.quantidade || 0),
        quantidade_reservada: Number(est.quantidade_reservada || 0),
        composicao_ativa: compAtiva
          ? {
              id: compAtiva.id,
              versao: compAtiva.versao,
              custo_adicional: Number(compAtiva.custo_adicional || 0),
              observacoes: compAtiva.observacoes,
              itens: (compAtiva.cesta_composicao_itens || []).map((ci: any) => ({
                id: ci.id,
                componente_produto_id: ci.componente_produto_id,
                quantidade: Number(ci.quantidade),
                unidade: ci.unidade,
                componente: {
                  id: ci.componente?.id || ci.componente_produto_id,
                  nome: ci.componente?.nome || 'Componente',
                  preco_custo: Number(ci.componente?.preco_custo || 0),
                  unidade: ci.componente?.unidade || ci.unidade || 'UN',
                },
              })),
            }
          : null,
      }
    })

    return mapped
  },

  /**
   * Lista produtos que podem ser componentes na montagem (tipo_item = 'componente' ou 'padrao')
   */
  async listComponentesDisponiveis(empresaId: string) {
    const { data, error } = await supabase
      .from('produtos')
      .select('id, nome, codigo, unidade, preco_custo, estoques(quantidade)')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .in('tipo_item', ['componente', 'padrao'])
      .order('nome', { ascending: true })

    if (error) throw error
    return (data || []).map((c: any) => ({
      id: c.id,
      nome: c.nome,
      codigo: c.codigo,
      unidade: c.unidade || 'UN',
      preco_custo: Number(c.preco_custo || 0),
      estoque_atual: Number(c.estoques?.[0]?.quantidade || 0),
    }))
  },

  /**
   * Histórico de todas as versões de uma composição
   */
  async listHistoricoComposicoes(empresaId: string, cestaProdutoId: string) {
    const { data, error } = await supabase
      .from('cesta_composicoes')
      .select(`
        id,
        versao,
        ativa,
        custo_adicional,
        observacoes,
        created_at,
        created_by_user:usuarios!cesta_composicoes_created_by_fkey(nome),
        itens:cesta_composicao_itens(
          id,
          quantidade,
          unidade,
          componente:produtos!cesta_composicao_itens_componente_produto_id_fkey(
            id, nome, preco_custo, unidade
          )
        )
      `)
      .eq('empresa_id', empresaId)
      .eq('cesta_produto_id', cestaProdutoId)
      .order('versao', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Salva nova versão da composição via RPC SECURITY DEFINER
   */
  async salvarComposicao(input: SalvarComposicaoInput) {
    const { data, error } = await supabase.rpc('salvar_composicao_cesta', {
      p_cesta_produto_id: input.cesta_produto_id,
      p_custo_adicional: input.custo_adicional,
      p_itens: input.itens as any,
      p_observacoes: input.observacoes || null,
    })
    if (error) throw error
    return data as any
  },

  /**
   * Lista ordens de montagem
   */
  async listOrdensMontagem(empresaId: string, status?: string) {
    let query = supabase
      .from('ordens_montagem')
      .select(`
        id,
        empresa_id,
        numero,
        cesta_produto_id,
        composicao_versao_id,
        quantidade_planejada,
        quantidade_produzida,
        status,
        responsavel_usuario_id,
        data_montagem,
        observacoes,
        custo_unitario_efetivo,
        created_at,
        cesta:produtos!ordens_montagem_cesta_produto_id_fkey (id, nome, preco_venda),
        composicao:cesta_composicoes!ordens_montagem_composicao_versao_id_fkey (id, versao, custo_adicional),
        responsavel:usuarios!ordens_montagem_responsavel_usuario_id_fkey (id, nome)
      `)
      .eq('empresa_id', empresaId)

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('numero', { ascending: false })
    if (error) throw error
    return (data || []) as unknown as OrdemMontagemItem[]
  },

  /**
   * Cria nova ordem de montagem via RPC
   */
  async criarOrdemMontagem(params: {
    cestaProdutoId: string
    quantidadePlanejada: number
    dataMontagem?: string
    observacoes?: string | null
  }) {
    const { data, error } = await supabase.rpc('criar_ordem_montagem', {
      p_cesta_produto_id: params.cestaProdutoId,
      p_quantidade_planejada: params.quantidadePlanejada,
      p_data_montagem: params.dataMontagem || undefined,
      p_observacoes: params.observacoes || null,
    })
    if (error) throw error
    return data as any
  },

  /**
   * Finaliza montagem de cestas (atômica, baixa componentes, adiciona cestas, atualiza custo médio)
   */
  async finalizarMontagemCestas(ordemId: string, quantidadeProduzida?: number) {
    const { data, error } = await supabase.rpc('finalizar_montagem_cestas', {
      p_ordem_id: ordemId,
      p_quantidade_produzida: quantidadeProduzida || undefined,
    })
    if (error) throw error
    return data as any
  },

  /**
   * Cancela uma ordem de montagem planejada
   */
  async cancelarOrdemMontagem(ordemId: string) {
    const { data, error } = await supabase.rpc('cancelar_ordem_montagem', {
      p_ordem_id: ordemId,
    })
    if (error) throw error
    return data as any
  },
}
