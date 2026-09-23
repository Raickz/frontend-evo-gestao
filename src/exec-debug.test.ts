import { describe, it, expect } from 'vitest'
import { supabase } from '@/lib/supabase/client'

describe('Execução Real da RPC de Conciliação C1', () => {
  it('imprime e valida os resultados retornados pelo banco', async () => {
    const { data, error } = await supabase.rpc('executar_teste_conciliacao_c1' as any)
    if (error) {
      throw new Error(`RPC FAILED: ${error.message} - ${error.details}`)
    }
    // Lança um erro contendo o JSON para inspecionarmos nos logs de QA se o teste falhar
    const output = JSON.stringify(data, null, 2)
    // Mostra o output intencionalmente para captura de evidência real
    expect(`RESULTADO_REAL_BANCO: ${output}`).toBe('PASS')
  })
})
