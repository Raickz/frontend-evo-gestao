import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export type UsuarioPerfil = 'master' | 'admin' | 'gerente' | 'vendedor' | 'operador' | string

export interface UsuarioProfile extends Tables<'usuarios'> {}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UsuarioProfile | null
  empresaId: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UsuarioProfile | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (authUserId: string) => {
    try {
      // 1. Fetch user row from usuarios table
      const { data: usuarioData, error: usuarioErr } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (!usuarioErr && usuarioData) {
        setProfile(usuarioData)
        if (usuarioData.empresa_id) {
          setEmpresaId(usuarioData.empresa_id)
          return
        }
      }

      // 2. Fallback to RPC get_my_empresa_id() if empresa_id was not populated directly
      const { data: rpcEmpresaId, error: rpcErr } = await supabase.rpc('get_my_empresa_id')
      if (!rpcErr && rpcEmpresaId) {
        setEmpresaId(rpcEmpresaId)
      } else {
        setEmpresaId(null)
      }
    } catch (e) {
      console.error('Erro ao resolver perfil/empresa do usuário:', e)
      setProfile(null)
      setEmpresaId(null)
    }
  }

  useEffect(() => {
    // Note: forbidden to have async/await directly inside onAuthStateChange callback
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      const currentUser = currentSession?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        fetchUserProfile(currentUser.id).finally(() => {
          setLoading(false)
        })
      } else {
        setProfile(null)
        setEmpresaId(null)
        setLoading(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      const initialUser = initialSession?.user ?? null
      setUser(initialUser)
      if (initialUser) {
        fetchUserProfile(initialUser.id).finally(() => {
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    return { error: null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) return { error }
    return { error: null }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    setProfile(null)
    setEmpresaId(null)
    if (error) return { error }
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        empresaId,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
