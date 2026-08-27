import React, { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, Layers } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/70 dark:border-[#152342] mb-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3385FF] border border-[#0066FF]/25">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-slate-500 dark:text-[#C0C6CF] mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon = Layers,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-[#1F3158] bg-white/50 dark:bg-[#0C172E]/50 backdrop-blur-md shadow-xs">
      <div className="h-12 w-12 rounded-2xl bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-[#C0C6CF] max-w-sm mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs h-8"
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
}

export function ErrorState({
  title = 'Erro ao carregar dados',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 backdrop-blur-md">
      <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
      <h3 className="text-sm font-bold text-red-900 dark:text-red-300 mb-1">{title}</h3>
      <p className="text-xs text-red-700 dark:text-red-400 max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30 flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 bg-white/60 dark:bg-[#0D1933]/60 p-4 rounded-xl border border-slate-200/80 dark:border-[#18284B] backdrop-blur-md">
      <div className="flex gap-4 border-b border-slate-100 dark:border-[#18284B] pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`head-${i}`} className="h-4 flex-1 dark:bg-slate-800" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`row-${r}`} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`cell-${r}-${c}`} className="h-4 flex-1 dark:bg-slate-800/60" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: string
}) {
  return (
    <div className="glass-card glass-card-hover rounded-2xl p-4 flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
          {title}
        </span>
        <div className="h-8 w-8 rounded-xl bg-[#0066FF]/10 dark:bg-[#0066FF]/20 text-[#0066FF] dark:text-[#3385FF] flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
          {value}
        </div>
        {(subtitle || trend) && (
          <p className="text-xs text-slate-500 dark:text-[#6E7785] mt-1 flex items-center gap-1">
            {trend && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{trend}</span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </p>
        )}
      </div>
    </div>
  )
}
