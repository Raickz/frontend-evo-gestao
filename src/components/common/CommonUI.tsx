import { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { LucideIcon, AlertCircle, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-[#1A294A]',
        className,
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
            {title}
          </h1>
          {badge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border border-[#0066FF]/20">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-slate-500 dark:text-[#C0C6CF] leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  )
}

interface GlassCardProps {
  children: ReactNode
  className?: string
  hoverEffect?: boolean
}

export function GlassCard({ children, className, hoverEffect = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-2xl transition-all duration-200',
        hoverEffect && 'glass-card-hover',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: string | number
    isPositive: boolean
  }
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'glass-card glass-card-hover rounded-2xl p-5 border border-slate-200/80 dark:border-[#1A294A] transition-all duration-200',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
          {title}
        </span>
        {Icon && (
          <div
            className={cn(
              'w-9 h-9 rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] flex items-center justify-center shrink-0 shadow-xs',
              iconColor,
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {trend && (
              <span
                className={`text-xs font-bold ${
                  trend.isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trend.isPositive ? '↑ +' : '↓ '}
                {trend.value}
              </span>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'glass-card flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-[#1A294A]',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] flex items-center justify-center mb-4 shadow-inner">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#C0C6CF] max-w-md mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="sm"
          className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold shadow-sm px-4 rounded-xl"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Erro ao carregar dados',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'glass-card flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-rose-500/30 bg-rose-500/5',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs rounded-xl"
        >
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-[#1A294A]">
        <div className="flex items-center justify-between pb-2 gap-3">
          <Skeleton className="h-9 w-64 rounded-xl dark:bg-slate-800" />
          <Skeleton className="h-9 w-32 rounded-xl dark:bg-slate-800" />
        </div>
      </div>
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
        <div className="h-12 bg-slate-50/70 dark:bg-[#0A1328]/70 border-b border-slate-200/80 dark:border-[#1A294A] px-4 flex items-center gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 rounded-md dark:bg-slate-800" />
          ))}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-[#1A294A]">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="h-14 px-4 flex items-center gap-4">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton key={c} className="h-4 flex-1 rounded-md dark:bg-slate-800" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const s = (status || '').toLowerCase()
  let styleClasses = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'

  if (
    s === 'ativo' ||
    s === 'aprovado' ||
    s === 'finalizada' ||
    s === 'finalizado' ||
    s === 'pago' ||
    s === 'concluido' ||
    s === 'recebido' ||
    s === 'ativa'
  ) {
    styleClasses =
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 font-semibold'
  } else if (
    s === 'pendente' ||
    s === 'aberto' ||
    s === 'processando' ||
    s === 'trial' ||
    s === 'orçamento' ||
    s === 'orcamento'
  ) {
    styleClasses =
      'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 font-semibold'
  } else if (
    s === 'cancelado' ||
    s === 'cancelada' ||
    s === 'rejeitado' ||
    s === 'inativo' ||
    s === 'bloqueado' ||
    s === 'atrasado' ||
    s === 'zerado'
  ) {
    styleClasses =
      'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25 font-semibold'
  } else if (s === 'em_andamento' || s === 'parcial' || s === 'alerta' || s === 'abaixo_minimo') {
    styleClasses =
      'bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border-[#0066FF]/25 font-semibold'
  }

  const displayLabel = label || status

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border font-medium capitalize',
        styleClasses,
        className,
      )}
    >
      {displayLabel}
    </span>
  )
}
