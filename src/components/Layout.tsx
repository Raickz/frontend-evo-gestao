import { useState, useMemo } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  BarChart3,
  Users,
  ShoppingCart,
  ClipboardList,
  Package,
  Truck,
  Boxes,
  UserCheck,
  CircleDollarSign,
  Percent,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Building2,
  Bell,
  Search,
  ShieldCheck,
  ChevronLeft,
  Layers,
  Briefcase,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { formatPerfilBadge, canAccessPage, AppPage } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  page: AppPage
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const ALL_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Visão Geral',
    items: [
      { title: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, page: 'dashboard' },
      { title: 'Relatórios', href: '/app/relatorios', icon: BarChart3, page: 'relatorios' },
      { title: 'Lucro', href: '/app/relatorio-lucro', icon: TrendingUp, page: 'relatorio_lucro' },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { title: 'Clientes', href: '/app/clientes', icon: Users, page: 'clientes' },
      { title: 'Vendas', href: '/app/vendas', icon: ShoppingCart, page: 'vendas' },
      { title: 'Pedidos', href: '/app/pedidos', icon: ClipboardList, page: 'pedidos' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { title: 'Produtos', href: '/app/produtos', icon: Package, page: 'produtos' },
      { title: 'Fornecedores', href: '/app/fornecedores', icon: Truck, page: 'fornecedores' },
      { title: 'Compras', href: '/app/compras', icon: ShoppingCart, page: 'compras' },
      { title: 'Estoque', href: '/app/estoque', icon: Layers, page: 'estoque' },
      { title: 'Vendedores', href: '/app/vendedores', icon: Briefcase, page: 'vendedores' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { title: 'Financeiro', href: '/app/financeiro', icon: CircleDollarSign, page: 'financeiro' },
      { title: 'Comissões', href: '/app/comissoes', icon: Percent, page: 'comissoes' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { title: 'Configurações', href: '/app/configuracoes', icon: Settings, page: 'configuracoes' },
    ],
  },
]

export default function Layout() {
  const { user, usuario, logout } = useAuth()
  const { empresa } = useEmpresa()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  const roleInfo = formatPerfilBadge(usuario?.perfil)

  // Filtragem das seções e itens conforme perfil do usuário
  const visibleNavSections = useMemo(() => {
    return ALL_NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessPage(usuario?.perfil, item.page)),
    })).filter((section) => section.items.length > 0)
  }, [usuario?.perfil])

  const canAccessSettings = useMemo(() => {
    return canAccessPage(usuario?.perfil, 'configuracoes')
  }, [usuario?.perfil])

  const currentRouteName = () => {
    for (const section of ALL_NAV_SECTIONS) {
      for (const item of section.items) {
        if (location.pathname.startsWith(item.href)) {
          return item.title
        }
      }
    }
    return 'EVO Gestão'
  }

  const userInitials = usuario?.nome
    ? usuario.nome
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'EV'

  const empresaNome = empresa?.nome_fantasia || empresa?.nome || 'EVO Gestão'

  return (
    <div className="flex min-h-screen bg-[#F5F7FB] text-[#0F172A] font-sans antialiased">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0E1B2C] text-slate-300 border-r border-slate-800 transition-all duration-300 ${
          collapsed ? 'w-[76px]' : 'w-[260px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand / Company Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold shadow-md shadow-teal-950/40 shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold text-white tracking-tight truncate">
                  {empresaNome}
                </span>
                <span className="text-[11px] text-teal-400 font-medium">EVO Gestão Comercial</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-7 w-7 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white items-center justify-center transition-colors"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-8 w-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
          {visibleNavSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed ? (
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400/80 mb-2">
                  {section.title}
                </p>
              ) : (
                <div className="h-px bg-slate-800 my-2 mx-1" />
              )}
              {section.items.map((item) => {
                const isActive = location.pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                      isActive
                        ? 'bg-teal-600/20 text-teal-400 shadow-sm border border-teal-500/30'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                    title={collapsed ? item.title : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-teal-400 rounded-r-full" />
                    )}
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* User Card / Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0B1522]">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-9 w-9 border border-teal-500/30 bg-teal-900/50 text-teal-200">
                  <AvatarFallback className="bg-teal-800 text-xs font-bold text-white">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {usuario?.nome || user?.email?.split('@')[0] || 'Usuário'}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-300 font-medium border border-teal-800/40">
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Sair do sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Sair do sistema"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium hidden sm:inline">
                EVO Gestão
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              <h1 className="text-base font-bold text-slate-900">{currentRouteName()}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-lg text-xs text-slate-600">
              <Search className="w-3.5 h-3.5 text-slate-600" />
              <span>Buscar registros (em breve)</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-600 hover:text-slate-900 rounded-lg h-9 w-9"
              title="Notificações"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600">
                  <Avatar className="h-8 w-8 bg-teal-700 text-white font-bold text-xs">
                    <AvatarFallback className="bg-teal-700 text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 leading-tight">
                      {usuario?.nome || 'Usuário'}
                    </p>
                    <p className="text-[10px] text-slate-600 font-medium">{roleInfo.label}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {usuario?.nome || 'Usuário EVO'}
                    </p>
                    <p className="text-xs text-slate-600 truncate">{user?.email}</p>
                    <div className="pt-1 flex items-center gap-1 text-[11px] text-teal-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{empresaNome}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                {canAccessSettings && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/app/configuracoes')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configurações da Empresa
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair do EVO Gestão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Main Content with smooth fade */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
