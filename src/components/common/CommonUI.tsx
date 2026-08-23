import React, { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 mb-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
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
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-300 bg-white shadow-xs">
      <div className="h-14 w-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-teal-700 hover:bg-teal-800 text-white">
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
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-red-200 bg-red-50/50">
      <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
      <h3 className="text-sm font-bold text-red-900 mb-1">{title}</h3>
      <p className="text-xs text-red-700 max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-red-300 text-red-700 hover:bg-red-100 flex items-center gap-1.5"
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
    <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
      <div className="flex gap-4 border-b border-slate-100 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`head-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`row-${r}`} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`cell-${r}-${c}`} className="h-4 flex-1" />
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
    <Card className="rounded-xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
        {(subtitle || trend) && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            {trend && <span className="font-medium text-emerald-600">{trend}</span>}
            {subtitle && <span>{subtitle}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
