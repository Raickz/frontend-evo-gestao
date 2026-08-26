import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export type UsuarioPerfil =
  | 'master'
  | 'admin'
  | 'gerente'
  | 'vendedor'
  | 'operador'
  | 'platform_admin'
  | string

export interface Usuario extends Tables<'usuarios'> {}

interface AuthContextType {
  user: User | null
  session: Session | null
  usuario: Usuario | null
  empresaId: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  logout: () => Promise<{ error: Error | null }>
  refreshUsuario: () => Promise<void>
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
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (authUserId: string) => {
    try {
      // Consultar public.usuarios pelo auth_user_id filtrando apenas ativos
      const { data: usuarioData, error: usuarioErr } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('ativo', true)
        .maybeSingle()

      if (!usuarioErr && usuarioData && usuarioData.ativo) {
        setUsuario(usuarioData)
        if (usuarioData.empresa_id) {
          setEmpresaId(usuarioData.empresa_id)
          return
        }

        if (usuarioData.perfil === 'platform_admin') {
          setEmpresaId(null)
          return
        }

        // Fallback para get_my_empresa_id() caso empresa_id não venha preenchido
        const { data: rpcEmpresaId, error: rpcErr } = await supabase.rpc('get_my_empresa_id')
        if (!rpcErr && rpcEmpresaId) {
          setEmpresaId(rpcEmpresaId)
          return
        } else {
          setEmpresaId(null)
          return
        }
      }

      // Se o usuário autenticado NÃO existir em usuarios OU estiver inativo: desconectar e limpar
      await supabase.auth.signOut()
      setUsuario(null)
      setEmpresaId(null)
      setUser(null)
      setSession(null)
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('Erro ao resolver usuario/empresa autenticada:', e)
      }
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore
      }
      setUsuario(null)
      setEmpresaId(null)
      setUser(null)
      setSession(null)
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
        setUsuario(null)
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

  const refreshUsuario = async () => {
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

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    setUsuario(null)
    setEmpresaId(null)
    setUser(null)
    setSession(null)
    if (error) return { error }
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        usuario,
        empresaId,
        loading,
        signIn,
        signUp,
        logout,
        refreshUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
