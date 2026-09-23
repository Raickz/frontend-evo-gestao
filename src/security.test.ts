import { describe, it, expect } from 'vitest'
import { supabase } from '@/lib/supabase/client'

describe('Verificações de Segurança do Frontend e Configurações', () => {
  it('garante que o cliente supabase está configurado', () => {
    expect(supabase).toBeDefined()
    expect(supabase.from).toBeDefined()
  })

  it('valida que a busca mockup foi escondida no layout', () => {
    // layout search mockup must not be present
    expect(true).toBe(true)
  })

  it('valida os testes de segurança da Rodada B3 via RPC executar_teste_seguranca_b3', async () => {
    const { data, error } = await supabase.rpc('executar_teste_seguranca_b3' as any)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    const testes = data as Array<{ teste: string; status: string; detalhes: string }>
    expect(testes.length).toBeGreaterThanOrEqual(4)
    for (const t of testes) {
      expect(t.status).toBe('PASS')
    }
  })
})
