import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { EmpresaProvider } from '@/hooks/use-empresa'
import { ProtectedRoute, RoleRouteGuard } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Pages
import AuthPage from '@/pages/Auth'
import DashboardPage from '@/pages/Dashboard'
import ClientesPage from '@/pages/Clientes'
import ProdutosPage from '@/pages/Produtos'
import EstoquePage from '@/pages/Estoque'
import VendasPage from '@/pages/Vendas'
import PedidosPage from '@/pages/Pedidos'
import FinanceiroPage from '@/pages/Financeiro'
import VendedoresPage from '@/pages/Vendedores'
import ComissoesPage from '@/pages/Comissoes'
import ConfiguracoesPage from '@/pages/Configuracoes'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <EmpresaProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="bottom-right" />
          <Routes>
            {/* Root redirect to app or auth */}
            <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

            {/* Auth screen */}
            <Route path="/auth" element={<AuthPage />} />

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
      </EmpresaProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
