import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/lib/supabase/client'

describe('Validação de Rotas e Tipagem do Módulo de Cestas', () => {
  it('garante que os serviços de cestas exportam os métodos necessários', async () => {
    const { CestasService } = await import('@/services/cestas')
    expect(CestasService).toBeDefined()
    expect(typeof CestasService.listCestas).toBe('function')
    expect(typeof CestasService.salvarComposicao).toBe('function')
    expect(typeof CestasService.criarOrdemMontagem).toBe('function')
    expect(typeof CestasService.finalizarMontagemCestas).toBe('function')
    expect(typeof CestasService.cancelarOrdemMontagem).toBe('function')
    expect(typeof CestasService.listOrdensMontagem).toBe('function')
    expect(typeof CestasService.listComponentesDisponiveis).toBe('function')
    expect(typeof CestasService.listHistoricoComposicoes).toBe('function')
  })

  it('garante que as páginas de Cestas e OrdensMontagem exportam componentes React válidos', async () => {
    const CestasMod = await import('@/pages/Cestas')
    const OrdensMod = await import('@/pages/OrdensMontagem')
    expect(CestasMod.default).toBeDefined()
    expect(OrdensMod.default).toBeDefined()
  })
})
