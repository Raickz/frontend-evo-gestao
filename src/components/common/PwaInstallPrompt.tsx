import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

const DISMISSED_STORAGE_KEY = 'evo_pwa_banner_dismissed'

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Não exibe se o usuário já dispensou nesta sessão
    if (sessionStorage.getItem(DISMISSED_STORAGE_KEY)) {
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    setShowPrompt(false)
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      sessionStorage.setItem(DISMISSED_STORAGE_KEY, 'true')
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, 'true')
  }

  if (!showPrompt) return null

  return (
    <div className="fixed top-2 left-2 right-2 sm:left-auto sm:right-4 sm:top-4 z-50 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#0A1328] text-white border border-[#1A2C50] shadow-2xl max-w-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[#0066FF] flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">Instalar EVO Gestão</p>
            <p className="text-[11px] text-[#A0AEC0] truncate">Acesso rápido na tela inicial</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="h-8 px-3 text-xs bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl"
          >
            Instalar
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-[#A0AEC0] hover:text-white rounded-lg hover:bg-white/10"
            title="Dispensar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
