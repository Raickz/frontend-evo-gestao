import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from './use-auth'
import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'
import { AssinaturasService, StatusAssinatura } from '@/services/assinaturas'

export interface EmpresaData extends Tables<'empresas'> {}

interface EmpresaContextType {
  empresa: EmpresaData | null
  empresaId: string | null
  loading: boolean
  error: string | null
  refreshEmpresa: () => Promise<void>
  statusAssinatura: StatusAssinatura | null
  loadingStatus: boolean
  acessoPermitido: boolean
  refreshStatus: () => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { usuario, loading: authLoading } = useAuth()
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusAssinatura, setStatusAssinatura] = useState<StatusAssinatura | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const fetchStatusAssinatura = useCallback(async () => {
    if (!usuario?.empresa_id) {
      setStatusAssinatura(null)
      setLoadingStatus(false)
      return
    }

    try {
      setLoadingStatus(true)
      const { data, error: statusErr } = await AssinaturasService.getStatus()
      if (statusErr) {
        if (import.meta.env.DEV) {
          console.error('Erro ao buscar status da assinatura:', statusErr)
        }
        setStatusAssinatura(null)
      } else {
        setStatusAssinatura(data)
      }
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Exceção ao buscar status da assinatura:', err)
      }
      setStatusAssinatura(null)
    } finally {
      setLoadingStatus(false)
    }
  }, [usuario?.empresa_id])

  const fetchEmpresa = useCallback(async () => {
    if (!usuario || !usuario.empresa_id) {
      setEmpresa(null)
      setStatusAssinatura(null)
      setLoading(false)
      setLoadingStatus(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [{ data, error: fetchError }] = await Promise.all([
        supabase.from('empresas').select('*').eq('id', usuario.empresa_id).single(),
        fetchStatusAssinatura(),
      ])

      if (fetchError) throw fetchError

      setEmpresa(data)
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao buscar dados da empresa:', err)
      }
      setError(err?.message || 'Falha ao buscar dados da empresa.')
      setEmpresa(null)
    } finally {
      setLoading(false)
    }
  }, [usuario?.empresa_id, fetchStatusAssinatura])

  useEffect(() => {
    if (!authLoading) {
      fetchEmpresa()
    }
  }, [authLoading, fetchEmpresa])

  // Acesso permitido padrão é true se ainda não carregou, ou avaliado pelo status
  const acessoPermitido = statusAssinatura ? statusAssinatura.acesso_permitido : true

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        empresaId: empresa?.id || usuario?.empresa_id || null,
        loading: loading || authLoading,
        error,
        refreshEmpresa: fetchEmpresa,
        statusAssinatura,
        loadingStatus,
        acessoPermitido,
        refreshStatus: fetchStatusAssinatura,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const context = useContext(EmpresaContext)
  if (context === undefined) {
    throw new Error('useEmpresa deve ser usado dentro de um EmpresaProvider')
  }
  return context
}

export function useAssinaturaStatus() {
  const { statusAssinatura, loadingStatus, acessoPermitido, refreshStatus } = useEmpresa()
  return {
    statusAssinatura,
    loadingStatus,
    acessoPermitido,
    refreshStatus,
  }
}
