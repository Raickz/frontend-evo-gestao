import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  Layers,
  Clock,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { formatPerfilBadge } from '@/lib/permissions'
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

interface AdminNavItem {
  title: string
  href: string
  icon: React.ElementType
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { title: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
  { title: 'Empresas', href: '/admin/empresas', icon: Building2 },
  { title: 'Planos', href: '/admin/planos', icon: Layers },
  { title: 'Histórico', href: '/admin/historico', icon: Clock },
]

export default function AdminLayout() {
  const { user, usuario, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  const roleInfo = formatPerfilBadge(usuario?.perfil)

  const currentRouteName = () => {
    for (const item of ADMIN_NAV_ITEMS) {
      if (location.pathname.startsWith(item.href)) {
        return item.title
      }
    }
    return 'Painel Administrativo'
  }

  const userInitials = usuario?.nome
    ? usuario.nome
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD'

  return (
    <div className="flex min-h-screen bg-[#0B1120] text-slate-100 font-sans antialiased selection:bg-sky-500/30 selection:text-sky-200">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Plataforma (fundo ultra escuro bg-slate-950) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-950 text-slate-300 border-r border-slate-800/90 transition-all duration-300 ${
          collapsed ? 'w-[76px]' : 'w-[260px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-md shadow-sky-950/60 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white tracking-tight truncate">
                    EVO Gestão
                  </span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 font-extrabold border border-sky-500/30">
                    Admin
                  </span>
                </div>
                <span className="text-[11px] text-sky-400/90 font-medium truncate">
                  Painel da Plataforma
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-7 w-7 rounded-lg bg-slate-900 text-slate-400 hover:text-white items-center justify-center transition-colors border border-slate-800"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-8 w-8 rounded-lg bg-slate-900 text-slate-300 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar">
          {!collapsed && (
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Gestão Global
            </p>
          )}
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 shadow-sm border border-sky-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
                title={collapsed ? item.title : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-sky-400 rounded-r-full" />
                )}
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            )
          })}

          <div className="pt-4 mt-4 border-t border-slate-900">
            <Link
              to="/planos"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors group"
              title={collapsed ? 'Página Pública de Planos' : undefined}
            >
              <ExternalLink className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-300" />
              {!collapsed && <span className="truncate">Ver Página Pública</span>}
            </Link>
          </div>
        </div>

        {/* User Card / Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-9 w-9 border border-sky-500/30 bg-sky-950 text-sky-300">
                  <AvatarFallback className="bg-sky-900 text-xs font-bold text-white">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {usuario?.nome || 'Admin Plataforma'}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-semibold border border-sky-800/50">
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Sair da plataforma"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                title="Sair da plataforma"
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
        <header className="sticky top-0 z-30 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Painel Administrativo
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              <h1 className="text-base font-bold text-white">{currentRouteName()}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/planos')}
              className="hidden md:flex h-8 px-2.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Ver Planos Públicos</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500">
                  <Avatar className="h-8 w-8 bg-sky-700 text-white font-bold text-xs">
                    <AvatarFallback className="bg-sky-700 text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-white leading-tight">
                      {usuario?.nome || 'Admin Plataforma'}
                    </p>
                    <p className="text-[10px] text-sky-400 font-medium">Super Administrador</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-slate-900 border-slate-800 text-slate-200"
              >
                <DropdownMenuLabel className="font-normal text-slate-300">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {usuario?.nome || 'Admin Plataforma'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    <div className="pt-1 flex items-center gap-1 text-[11px] text-sky-400 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>EVO Gestão Plataforma</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem
                  onClick={() => navigate('/planos')}
                  className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-slate-200"
                >
                  <ExternalLink className="w-4 h-4 mr-2 text-slate-400" />
                  Ir para Planos Públicos
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-400 hover:text-red-300 hover:bg-red-950/40 focus:bg-red-950/40 font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da Plataforma
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Main Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in-up bg-[#0B1120]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
