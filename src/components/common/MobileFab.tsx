import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileFabProps {
  label: string
  onClick: () => void
  icon?: React.ElementType
  variant?: 'primary' | 'emerald' | 'amber'
  className?: string
}

export function MobileFab({
  label,
  onClick,
  icon: Icon = Plus,
  variant = 'primary',
  className = '',
}: MobileFabProps) {
  const colorClasses = {
    primary: 'bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-[#0066FF]/30',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30',
    amber: 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/30 font-bold',
  }[variant]

  return (
    <div
      className={`lg:hidden fixed right-4 bottom-20 z-40 animate-fade-in-up ${className}`}
      style={{
        bottom: 'calc(4.5rem + max(env(safe-area-inset-bottom, 0px), 8px))',
      }}
    >
      <Button
        onClick={onClick}
        className={`h-12 px-5 rounded-full shadow-xl flex items-center gap-2 font-bold text-sm tracking-wide active:scale-95 transition-transform ${colorClasses}`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span>{label}</span>
      </Button>
    </div>
  )
}
