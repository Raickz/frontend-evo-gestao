import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { EmpresaProvider } from '@/hooks/use-empresa'
import { ProtectedRoute } from '@/components/ProtectedRoute'
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
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="produtos" element={<ProdutosPage />} />
              <Route path="estoque" element={<EstoquePage />} />
              <Route path="vendas" element={<VendasPage />} />
              <Route path="pedidos" element={<PedidosPage />} />
              <Route path="financeiro" element={<FinanceiroPage />} />
              <Route path="vendedores" element={<VendedoresPage />} />
              <Route path="comissoes" element={<ComissoesPage />} />
              <Route path="configuracoes" element={<ConfiguracoesPage />} />
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
