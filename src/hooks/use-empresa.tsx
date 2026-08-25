import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from './use-auth'
import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export interface EmpresaData extends Tables<'empresas'> {}

interface EmpresaContextType {
  empresaId: string | null
  empresa: EmpresaData | null
  loading: boolean
  refreshEmpresa: () => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

export const useEmpresa = () => {
  const context = useContext(EmpresaContext)
  if (!context) {
    throw new Error('useEmpresa must be used within an EmpresaProvider')
  }
  return context
}

export const EmpresaProvider = ({ children }: { children: ReactNode }) => {
  const { empresaId, user } = useAuth()
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchEmpresa = useCallback(async () => {
    if (!empresaId || !user) {
      setEmpresa(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresaId)
        .maybeSingle()

      if (!error && data) {
        setEmpresa(data)
      } else {
        setEmpresa(null)
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar dados da empresa:', err)
      }
      setEmpresa(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId, user])

  useEffect(() => {
    fetchEmpresa()
  }, [fetchEmpresa])

  return (
    <EmpresaContext.Provider
      value={{
        empresaId,
        empresa,
        loading,
        refreshEmpresa: fetchEmpresa,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}
