import { describe, it, expect } from 'vitest'
import { supabase } from '@/lib/supabase/client'

describe('Execução Real da RPC de Conciliação C1', () => {
  it('imprime e valida os resultados retornados pelo banco', async () => {
    const { data, error } = await supabase.rpc('executar_teste_conciliacao_c1' as any)
    console.log('RESULTADO CONCILIAÇÃO:', JSON.stringify(data, null, 2))
    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
})
