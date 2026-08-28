import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import '@/styles/print.css'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { EmpresaProvider } from '@/hooks/use-empresa'
import { ThemeProvider } from '@/hooks/use-theme'
import { ProtectedRoute, RoleRouteGuard } from '@/components/ProtectedRoute'
import { Building2, Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import AdminLayout from '@/components/AdminLayout'
import { AdminProtectedRoute } from '@/components/AdminProtectedRoute'

// Admin Pages
import AdminDashboardPage from '@/pages/admin/Dashboard'
import AdminEmpresasPage from '@/pages/admin/Empresas'
import AdminAssinaturasPage from '@/pages/admin/Assinaturas'
import AdminPlanosPage from '@/pages/admin/Planos'
import AdminHistoricoPage from '@/pages/admin/Historico'
import AdminTransacoesPage from '@/pages/admin/Transacoes'

// Pages
import PlanosPage from '@/pages/Planos'
import CheckoutPage from '@/pages/Checkout'
import CheckoutSucessoPage from '@/pages/CheckoutSucesso'
import SetupPage from '@/pages/Setup'
import AuthPage from '@/pages/Auth'
import DashboardPage from '@/pages/Dashboard'
import ClientesPage from '@/pages/Clientes'
import ProdutosPage from '@/pages/Produtos'
import FornecedoresPage from '@/pages/Fornecedores'
import ComprasPage from '@/pages/Compras'
import EstoquePage from '@/pages/Estoque'
import VendasPage from '@/pages/Vendas'
import PedidosPage from '@/pages/Pedidos'
import FinanceiroPage from '@/pages/Financeiro'
import VendedoresPage from '@/pages/Vendedores'
import ComissoesPage from '@/pages/Comissoes'
import ConfiguracoesPage from '@/pages/Configuracoes'
import RelatoriosPage from '@/pages/Relatorios'
import RelatorioLucroPage from '@/pages/RelatorioLucro'
import NotFound from '@/pages/NotFound'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

function BootstrapRedirect() {
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null)

  useEffect(() => {
    let isMounted = true

    async function checkBootstrap() {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/bootstrap-install`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
          },
        })

        if (!response.ok) {
          // Em caso de erro HTTP na checagem, assume bootstrapped para não travar rota protegida / auth
          if (isMounted) setBootstrapped(true)
          return
        }

        const data = await response.json()
        if (isMounted) {
          setBootstrapped(Boolean(data?.bootstrapped))
        }
      } catch {
        if (isMounted) {
          setBootstrapped(true)
        }
      }
    }

    checkBootstrap()

    return () => {
      isMounted = false
    }
  }, [])

  if (bootstrapped === null) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#0E1B2C] p-4">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 items-center justify-center shadow-xl shadow-teal-950/60 border border-teal-400/20 mb-4 animate-pulse">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-teal-400 mb-2" />
        <p className="text-slate-400 text-sm font-medium">Carregando EVO Gestão...</p>
      </div>
    )
  }

  if (bootstrapped === false) {
    return <Navigate to="/setup" replace />
  }

  return <Navigate to="/app/dashboard" replace />
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <EmpresaProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="bottom-right" />
            <Routes>
              {/* Root redirect com verificação de bootstrap */}
              <Route path="/" element={<BootstrapRedirect />} />

              {/* Página de Planos e Checkout públicos - Temporariamente restritos a platform_admin na UI do cliente */}
              <Route
                path="/planos"
                element={
                  <AdminProtectedRoute>
                    <PlanosPage />
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/checkout"
                element={
                  <AdminProtectedRoute>
                    <CheckoutPage />
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/checkout/sucesso"
                element={
                  <AdminProtectedRoute>
                    <CheckoutSucessoPage />
                  </AdminProtectedRoute>
                }
              />

              {/* Setup público */}
              <Route path="/setup" element={<SetupPage />} />

              {/* Auth screen */}
              <Route path="/auth" element={<AuthPage />} />

              {/* Rotas Administrativas da Plataforma (Platform Admin) */}
              <Route
                path="/admin"
                element={
                  <AdminProtectedRoute>
                    <AdminLayout />
                  </AdminProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="empresas" element={<AdminEmpresasPage />} />
                <Route path="assinaturas" element={<AdminAssinaturasPage />} />
                <Route path="planos" element={<AdminPlanosPage />} />
                <Route path="transacoes" element={<AdminTransacoesPage />} />
                <Route path="historico" element={<AdminHistoricoPage />} />
              </Route>
              {/* Protected App Shell */}
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route
                  path="dashboard"
                  element={
                    <RoleRouteGuard page="dashboard">
                      <DashboardPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="relatorios"
                  element={
                    <RoleRouteGuard page="relatorios">
                      <RelatoriosPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="relatorio-lucro"
                  element={
                    <RoleRouteGuard page="relatorio_lucro">
                      <RelatorioLucroPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="clientes"
                  element={
                    <RoleRouteGuard page="clientes">
                      <ClientesPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="produtos"
                  element={
                    <RoleRouteGuard page="produtos">
                      <ProdutosPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="fornecedores"
                  element={
                    <RoleRouteGuard page="fornecedores">
                      <FornecedoresPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="compras"
                  element={
                    <RoleRouteGuard page="compras">
                      <ComprasPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="estoque"
                  element={
                    <RoleRouteGuard page="estoque">
                      <EstoquePage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="vendas"
                  element={
                    <RoleRouteGuard page="vendas">
                      <VendasPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="pedidos"
                  element={
                    <RoleRouteGuard page="pedidos">
                      <PedidosPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="financeiro"
                  element={
                    <RoleRouteGuard page="financeiro">
                      <FinanceiroPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="vendedores"
                  element={
                    <RoleRouteGuard page="vendedores">
                      <VendedoresPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="comissoes"
                  element={
                    <RoleRouteGuard page="comissoes">
                      <ComissoesPage />
                    </RoleRouteGuard>
                  }
                />
                <Route
                  path="configuracoes"
                  element={
                    <RoleRouteGuard page="configuracoes">
                      <ConfiguracoesPage />
                    </RoleRouteGuard>
                  }
                />
              </Route>

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </ThemeProvider>
      </EmpresaProvider>
    </AuthProvider>
  </BrowserRouter>
)
export default App
