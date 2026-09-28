import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Navigation,
  ShoppingCart,
  UserCheck,
  Users,
  Menu,
  ClipboardList,
  LayoutDashboard,
  Layers,
} from 'lucide-react'
import { normalizeRole, canAccessPage } from '@/lib/permissions'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'

interface BottomNavProps {
  onOpenMenu: () => void
}

interface BottomNavItem {
  title: string
  href: string
  icon: React.ElementType
  highlight?: boolean
}

export function MobileBottomNav({ onOpenMenu }: BottomNavProps) {
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const location = useLocation()
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Detecta teclado aberto via visualViewport resize
  useEffect(() => {
    if (!window.visualViewport) return

    const handleResize = () => {
      if (!window.visualViewport) return
      // Se a altura visual diminui mais de 150px em relação à janela, teclado está aberto
      const keyboardShowing = window.innerHeight - window.visualViewport.height > 150
      setIsKeyboardOpen(keyboardShowing)
    }

    window.visualViewport.addEventListener('resize', handleResize)
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize)
    }
  }, [])

  // Detecta se algum Dialog, modal ou formulário ativo com aria-modal ou radix-dialog está aberto
  useEffect(() => {
    const checkModalOrForm = () => {
      const modalActive =
        document.querySelector('[data-state="open"][role="dialog"]') !== null ||
        document.querySelector('[role="alertdialog"][data-state="open"]') !== null ||
        document.body.classList.contains('overflow-hidden') ||
        document.querySelector('[aria-modal="true"]') !== null

      // Detecta se há campo de entrada com foco ativo no celular
      const activeEl = document.activeElement
      const inputActive =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)

      setIsModalOpen(modalActive || inputActive)
    }

    const handleFocusChange = () => {
      checkModalOrForm()
    }

    window.addEventListener('focusin', handleFocusChange)
    window.addEventListener('focusout', handleFocusChange)

    const observer = new MutationObserver(checkModalOrForm)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    checkModalOrForm()

    return () => {
      window.removeEventListener('focusin', handleFocusChange)
      window.removeEventListener('focusout', handleFocusChange)
      observer.disconnect()
    }
  }, [])

  const role = normalizeRole(usuario?.perfil)

  // Monta itens conforme perfil e módulos
  const items: BottomNavItem[] = useMemo(() => {
    const hasCrediario = Boolean(empresa?.modulos?.modulo_crediario)

    if (role === 'entregador') {
      return [
        { title: 'Minha Rota', href: '/app/minha-rota', icon: Navigation },
        { title: 'Vender', href: '/app/vendas', icon: ShoppingCart },
        { title: 'Devedores', href: '/app/devedores', icon: UserCheck },
        { title: 'Clientes', href: '/app/clientes', icon: Users },
      ]
    }

    if (role === 'vendedor') {
      return [
        { title: 'Vender', href: '/app/vendas', icon: ShoppingCart, highlight: true },
        { title: 'Pedidos', href: '/app/pedidos', icon: ClipboardList },
        { title: 'Devedores', href: '/app/devedores', icon: UserCheck },
        { title: 'Clientes', href: '/app/clientes', icon: Users },
      ]
    }

    // Master / Admin / Gerente / Operador / Platform Admin
    const fourthItem: BottomNavItem =
      hasCrediario && canAccessPage(usuario?.perfil, 'devedores')
        ? { title: 'Devedores', href: '/app/devedores', icon: UserCheck }
        : { title: 'Estoque', href: '/app/estoque', icon: Layers }

    return [
      { title: 'Início', href: '/app/dashboard', icon: LayoutDashboard },
      { title: 'Vender', href: '/app/vendas', icon: ShoppingCart, highlight: true },
      { title: 'Pedidos', href: '/app/pedidos', icon: ClipboardList },
      fourthItem,
    ]
  }, [role, empresa?.modulos, usuario?.perfil])

  // Se teclado ou modal aberto, oculta para não cobrir ações de formulário
  if (isKeyboardOpen || isModalOpen) {
    return null
  }

  return (
    <nav
      aria-label="Navegação móvel"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0A1328]/95 backdrop-blur-lg border-t border-slate-200/90 dark:border-[#152342] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1 items-center">
        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-[#0066FF] font-bold dark:text-[#3385FF]'
                  : 'text-slate-500 dark:text-[#8E99A8] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#3385FF]'
                    : item.highlight
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : ''
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 bg-[#0066FF] rounded-full" />
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-1 truncate max-w-full">
                {item.title}
              </span>
            </Link>
          )
        })}

        {/* Botão "Mais" abre o menu lateral completo */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl text-slate-500 dark:text-[#8E99A8] hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-xl">
            <Menu className="w-5 h-5 shrink-0" />
          </div>
          <span className="text-[10px] tracking-tight leading-none mt-1 truncate">Mais</span>
        </button>
      </div>
    </nav>
  )
}
