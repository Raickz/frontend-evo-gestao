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
  CircleDollarSign,
  Percent,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  Search,
  ShieldCheck,
  ChevronLeft,
  Layers,
  Briefcase,
  TrendingUp,
  Clock,
  Sparkles,
  Sun,
  Moon,
  HelpCircle,
  CreditCard,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { useTheme } from '@/hooks/use-theme'
import { EvoHexagonLogo } from '@/components/common/EvoLogo'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PhoneCall } from 'lucide-react'

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
  const { theme, toggleTheme } = useTheme()
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

  const [modalSuporteOpen, setModalSuporteOpen] = useState(false)

  const userInitials = usuario?.nome
    ? usuario.nome
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'EV'

  const empresaNome = empresa?.nome_fantasia || empresa?.nome || 'Minha Empresa'

  return (
    <div className="flex min-h-screen bg-[#F5F7FB] dark:bg-[#050B18] text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-300">
      {/* Background Decorativo Sutil EVO Dark (apenas no modo escuro) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-0 dark:opacity-100 transition-opacity duration-500">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[#0066FF]/[0.035] rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-[500px] h-[500px] bg-[#0052CC]/[0.025] rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-[#0A1328]/40 rounded-full blur-2xl" />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: SOLID Navy #0A1328 (Rule 2: NO glassmorphism, no blur, no transparency, solid & crisp) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0A1328] text-[#C0C6CF] border-r border-[#152342] transition-all duration-300 select-none ${
          collapsed ? 'w-[76px]' : 'w-[260px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header with EVO Hexagon Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#152342] bg-[#081022]">
          <Link
            to="/app/dashboard"
            className="flex items-center gap-2.5 overflow-hidden group focus:outline-none"
            onClick={() => setMobileOpen(false)}
          >
            <EvoHexagonLogo size={32} />
            {!collapsed && (
              <div className="flex flex-col truncate leading-none">
                <div className="flex items-center gap-1">
                  <span className="text-[15px] font-black tracking-tight text-white">EVO</span>
                  <span className="text-[15px] font-bold tracking-tight text-[#0066FF]">
                    Gestão
                  </span>
                </div>
                <span className="text-[10px] text-[#6E7785] font-medium tracking-wide uppercase truncate mt-0.5">
                  {empresaNome}
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-7 w-7 rounded-lg bg-[#111F38] text-[#C0C6CF] hover:text-white hover:bg-[#0066FF]/20 border border-[#1E2F52] items-center justify-center transition-colors cursor-pointer"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-8 w-8 rounded-lg bg-[#111F38] text-[#C0C6CF] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links with Blue EVO selection highlight */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5 custom-scrollbar">
          {/* Link Platform Admin */}
          {usuario?.perfil === 'platform_admin' && (
            <div className="space-y-1">
              {!collapsed ? (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#0066FF] mb-1.5">
                  Plataforma
                </p>
              ) : (
                <div className="h-px bg-[#152342] my-2 mx-1" />
              )}
              <Link
                to="/admin/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all bg-[#0066FF]/15 text-[#3385FF] border border-[#0066FF]/30 hover:bg-[#0066FF]/25 hover:text-white"
                title={collapsed ? 'Painel Admin' : undefined}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-[#0066FF]" />
                {!collapsed && <span className="truncate">Painel Admin</span>}
              </Link>
            </div>
          )}

          {visibleNavSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed ? (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#6E7785] mb-1">
                  {section.title}
                </p>
              ) : (
                <div className="h-px bg-[#152342] my-2 mx-1" />
              )}
              {section.items.map((item) => {
                const isActive = location.pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative ${
                      isActive
                        ? 'bg-[#0066FF] text-white shadow-md shadow-[#0066FF]/25 font-semibold'
                        : 'text-[#C0C6CF] hover:bg-[#111F38] hover:text-white'
                    }`}
                    title={collapsed ? item.title : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1 bottom-1 w-1 bg-white rounded-r-full" />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-white' : 'text-[#6E7785] group-hover:text-[#C0C6CF]'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Bottom Sidebar Footer: User Info & Support */}
        <div className="p-2.5 border-t border-[#152342] bg-[#081022] space-y-2">
          {!collapsed ? (
            <>
              {/* Support Quick Link */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0E1A33] border border-[#1A2C50] text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <HelpCircle className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />
                  <span className="text-[#C0C6CF] truncate font-medium">Central de Suporte</span>
                </div>
                <button
                  onClick={() => setModalSuporteOpen(true)}
                  className="flex items-center gap-1 text-[10px] text-[#0066FF] hover:text-[#3385FF] font-semibold transition-colors shrink-0"
                  title="Suporte EVO"
                >
                  Ajuda
                </button>
              </div>

              {/* Logged User Info */}
              <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#0E1A33]/70 border border-[#1A2C50]/60">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-7 w-7 border border-[#0066FF]/40 bg-[#0066FF]/20 text-[#3385FF]">
                    <AvatarFallback className="bg-[#0066FF] text-[10px] font-bold text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="truncate leading-tight">
                    <p className="text-[11px] font-semibold text-white truncate">
                      {usuario?.nome || user?.email?.split('@')[0] || 'Usuário'}
                    </p>
                    <span className="text-[9px] text-[#6E7785] uppercase tracking-wider">
                      {roleInfo.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 text-[#6E7785] hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Sair do EVO Gestão"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={() => setModalSuporteOpen(true)}
                className="p-1.5 text-[#6E7785] hover:text-[#0066FF] rounded-lg hover:bg-[#111F38] transition-colors"
                title="Suporte EVO"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 text-[#6E7785] hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Sair do sistema"
              >
                <LogOut className="w-4 h-4" />
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
        {/* Header Superior Global (Light / Dark responsive) */}
        <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-[#0A1328]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-[#152342] px-4 sm:px-6 flex items-center justify-between shadow-xs transition-colors duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-[#C0C6CF] hover:bg-slate-100 dark:hover:bg-[#111F38]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-[#6E7785] font-medium hidden sm:inline">
                EVO Gestão
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-[#6E7785] hidden sm:inline" />
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {currentRouteName()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Search Bar mockup */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-[#0E1A33] border border-slate-200 dark:border-[#1A2C50] rounded-lg text-xs text-slate-500 dark:text-[#C0C6CF]">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#6E7785]" />
              <span>Buscar vendas, clientes ou produtos...</span>
            </div>

            {/* Theme Toggle Button (Requirement #4, #15, #16) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg text-slate-600 dark:text-[#C0C6CF] hover:text-[#0066FF] dark:hover:text-[#3385FF] hover:bg-slate-100 dark:hover:bg-[#111F38]"
              title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-90" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 transition-transform -rotate-12 hover:rotate-0" />
              )}
            </Button>

            {/* Notifications Button */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-600 dark:text-[#C0C6CF] hover:text-slate-900 dark:hover:text-white rounded-lg h-9 w-9 hover:bg-slate-100 dark:hover:bg-[#111F38]"
              title="Notificações"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#0066FF] rounded-full ring-2 ring-white dark:ring-[#0A1328]" />
            </Button>

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#111F38] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0066FF]">
                  <Avatar className="h-8 w-8 bg-[#0066FF] text-white font-bold text-xs shadow-xs">
                    <AvatarFallback className="bg-[#0066FF] text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {usuario?.nome || 'Master Demo'}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-[#6E7785] font-medium">
                      {roleInfo.label}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 dark:bg-[#0A1328] dark:border-[#152342]"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {usuario?.nome || 'Master Demo'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#6E7785] truncate">
                      {user?.email}
                    </p>
                    <div className="pt-1 flex items-center gap-1 text-[11px] text-[#0066FF] font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{empresaNome}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                {usuario?.perfil === 'platform_admin' && (
                  <>
                    <DropdownMenuSeparator className="dark:bg-[#152342]" />
                    <DropdownMenuItem
                      onClick={() => navigate('/admin/dashboard')}
                      className="text-sky-600 font-semibold cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Painel da Plataforma
                    </DropdownMenuItem>
                  </>
                )}
                {canAccessSettings && (
                  <>
                    <DropdownMenuSeparator className="dark:bg-[#152342]" />
                    <DropdownMenuItem
                      onClick={() => navigate('/app/configuracoes')}
                      className="cursor-pointer dark:hover:bg-[#111F38]"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configurações da Empresa
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="dark:bg-[#152342]" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 font-medium cursor-pointer dark:hover:bg-[#111F38]"
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

      {/* Modal Informativo Global de Suporte EVO Gestão */}
      <Dialog open={modalSuporteOpen} onOpenChange={setModalSuporteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-2">
              <PhoneCall className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Suporte Técnico EVO Gestão
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Entre em contato com nossa equipe para tirar dúvidas ou solicitar assistência técnica.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            <div className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/50 space-y-1.5">
              <p className="font-semibold text-sky-900">
                Atendimento ao Cliente
              </p>
              <p className="text-slate-600">
                Estamos disponíveis para auxiliar no uso das ferramentas, configurações da sua empresa e dúvidas operacionais.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500 font-medium">E-mail de Suporte:</span>
              <span className="font-mono font-semibold text-slate-900">
                suporte@evogestao.com.br
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalSuporteOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
