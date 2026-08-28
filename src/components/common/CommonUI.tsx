import React from 'react'
import {
  LucideIcon,
  Search,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  AnimatedNumber,
  type AnimatedNumberProps,
  parseNumberAndFormat,
  formatAnimatedValue,
} from './AnimatedNumber'

export { AnimatedNumber, type AnimatedNumberProps, parseNumberAndFormat, formatAnimatedValue }

/* =========================================================================
   2. PAGE HEADER
   ========================================================================= */
export interface PageHeaderProps {
  title: string
  description?: string
  badge?: string | React.ReactNode
  actions?: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
  className?: string
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1',
        className,
      )}
    >
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#C0C6CF]/70 mb-1">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-slate-400 dark:text-slate-600">/</span>}
                {b.href ? (
                  <a href={b.href} className="hover:text-[#0066FF] transition-colors">
                    {b.label}
                  </a>
                ) : (
                  <span>{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {badge &&
            (typeof badge === 'string' ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border border-[#0066FF]/20">
                {badge}
              </span>
            ) : (
              badge
            ))}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#C0C6CF]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap shrink-0">{actions}</div>}
    </div>
  )
}

/* =========================================================================
   3. STAT / METRIC CARD (Com AnimatedNumber integrado)
   ========================================================================= */
export interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: string | number
    isPositive: boolean
    label?: string
  }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  loading?: boolean
  className?: string
  onClick?: () => void
  animate?: boolean
}

const variantStyles: Record<
  NonNullable<StatCardProps['variant']>,
  {
    iconBg: string
    iconColor: string
    borderColor?: string
  }
> = {
  default: {
    iconBg: 'bg-[#0066FF]/10 dark:bg-[#0066FF]/15',
    iconColor: 'text-[#0066FF]',
  },
  primary: {
    iconBg: 'bg-[#0066FF]/10 dark:bg-[#0066FF]/20',
    iconColor: 'text-[#0066FF] dark:text-[#3B82F6]',
  },
  success: {
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  loading,
  className,
  onClick,
  animate = true,
}: StatCardProps) {
  const currentVariant = variantStyles[variant] || variantStyles.default

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-[#1A294A]">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-28 bg-slate-200 dark:bg-[#1A294A]" />
          <Skeleton className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-[#1A294A]" />
        </div>
        <Skeleton className="h-8 w-36 mb-2 bg-slate-200 dark:bg-[#1A294A]" />
        <Skeleton className="h-3 w-20 bg-slate-200 dark:bg-[#1A294A]" />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card glass-card-hover rounded-2xl p-5 border border-slate-200/80 dark:border-[#1A294A] flex flex-col justify-between relative overflow-hidden group',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]/80">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {animate ? <AnimatedNumber value={value} /> : value}
          </div>
        </div>
        {Icon && (
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-transparent transition-transform group-hover:scale-105',
              currentVariant.iconBg,
            )}
          >
            <Icon className={cn('w-5 h-5', currentVariant.iconColor)} />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-[#1A294A]/60 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md text-[11px]',
                trend.isPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
              )}
            >
              {trend.isPositive ? '+' : ''}
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-slate-500 dark:text-[#C0C6CF]/70 truncate">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  )
}

// Aliases para compatibilidade total com todas as páginas
export const MetricCard = StatCard
export type MetricCardProps = StatCardProps

/* =========================================================================
   4. GLASS CONTAINERS: GlassPanel, GlassCard, GlassCardHeader, etc.
   ========================================================================= */
export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function GlassPanel({ children, className, hover, ...props }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'glass-panel rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 sm:p-6 transition-all',
        hover && 'glass-card-hover',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function GlassCard({ children, className, hover, ...props }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 sm:p-5 transition-all',
        hover && 'glass-card-hover',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function GlassCardHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'pb-3 border-b border-slate-100 dark:border-[#1A294A] flex items-center justify-between gap-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function GlassCardContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('pt-4', className)}>{children}</div>
}

/* =========================================================================
   5. GLASS TABLE CONTAINER & ELEMENTS
   ========================================================================= */
interface GlassTableProps {
  children: React.ReactNode
  className?: string
}

export function GlassTable({ children, className }: GlassTableProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
          {children}
        </table>
      </div>
    </div>
  )
}

export function GlassTableHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <thead
      className={cn(
        'bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400',
        className,
      )}
    >
      {children}
    </thead>
  )
}

export function GlassTableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors border-b border-slate-100 dark:border-[#1A294A]/60 last:border-b-0',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function GlassTableCell({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className={cn('py-3 px-4 align-middle', className)}>
      {children}
    </td>
  )
}

export function GlassTableHead({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <th className={cn('py-3 px-4 font-bold select-none', className)}>{children}</th>
}

/* =========================================================================
   6. SEARCH BAR & FILTER BAR
   ========================================================================= */
export interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChangeValue?: (val: string) => void
  containerClassName?: string
}

export function SearchBar({
  value,
  onChangeValue,
  onChange,
  placeholder = 'Buscar...',
  className,
  containerClassName,
  ...props
}: SearchBarProps) {
  return (
    <div className={cn('relative flex-1', containerClassName)}>
      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0066FF] dark:text-[#3B82F6]/90 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => {
          onChange?.(e)
          onChangeValue?.(e.target.value)
        }}
        placeholder={placeholder}
        className={cn(
          'pl-9 h-10 bg-slate-50/80 dark:bg-[#0A1328]/60 border-slate-200 dark:border-[#1A294A] text-xs rounded-xl focus-visible:ring-[#0066FF] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'glass-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* =========================================================================
   7. GLASS INPUT & SELECT STYLES (Helpers / Classes)
   ========================================================================= */
export const glassInputClass =
  'h-10 bg-slate-50/80 dark:bg-[#0A1328]/60 border-slate-200 dark:border-[#1A294A] text-xs rounded-xl focus-visible:ring-[#0066FF] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500'

export const glassSelectTriggerClass =
  'h-10 bg-slate-50/80 dark:bg-[#0A1328]/60 border-slate-200 dark:border-[#1A294A] text-xs rounded-xl focus:ring-[#0066FF] dark:text-white'

export const glassSelectContentClass =
  'bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-white shadow-xl'

/* =========================================================================
   8. GLASS BUTTONS
   ========================================================================= */
export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  loading?: boolean
  children: React.ReactNode
}

export function GlassButton({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  children,
  className,
  disabled,
  ...props
}: GlassButtonProps) {
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs rounded-lg',
    md: 'h-10 px-4 text-xs font-semibold rounded-xl',
    lg: 'h-11 px-5 text-sm font-semibold rounded-xl',
  }

  const variantClasses = {
    primary: 'bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-sm shadow-[#0066FF]/20',
    secondary:
      'bg-slate-100 hover:bg-slate-200 dark:bg-[#111F38] dark:hover:bg-[#162746] text-slate-900 dark:text-white',
    outline:
      'border border-slate-200 dark:border-[#1A294A] hover:bg-slate-50 dark:hover:bg-[#111F38] text-slate-700 dark:text-[#C0C6CF]',
    danger:
      'bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/20 border-transparent',
    ghost: 'hover:bg-slate-100 dark:hover:bg-[#111F38] text-slate-600 dark:text-[#C0C6CF]',
  }

  return (
    <Button
      disabled={disabled || loading}
      className={cn(
        'transition-all flex items-center gap-2 cursor-pointer',
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : (
        Icon && <Icon className="w-3.5 h-3.5 shrink-0" />
      )}
      {children}
    </Button>
  )
}

/* =========================================================================
   9. GLASS MODAL (Dialog com Estética Dark Glass EVO)
   ========================================================================= */
export interface GlassModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  icon?: LucideIcon
  badge?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
}

export function GlassModal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  badge,
  children,
  footer,
  maxWidth = 'lg',
}: GlassModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-full max-h-[92vh] overflow-y-auto custom-scrollbar border border-slate-200/80 dark:border-[#1A294A] bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-2xl shadow-2xl rounded-2xl p-6 text-slate-900 dark:text-white',
          maxWidthMap[maxWidth] || 'max-w-lg',
        )}
      >
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {Icon && (
                <div className="w-9 h-9 rounded-xl bg-[#0066FF]/10 dark:bg-[#0066FF]/20 text-[#0066FF] dark:text-[#3B82F6] flex items-center justify-center shrink-0 border border-[#0066FF]/20">
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {title}
                </DialogTitle>
                {description && (
                  <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80 mt-0.5">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </div>
            {badge && (
              <Badge className="bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border-[#0066FF]/20 text-[11px] font-semibold">
                {badge}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="py-3 text-xs text-slate-700 dark:text-slate-200">{children}</div>

        {footer && (
          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#1A294A] gap-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* =========================================================================
   10. GLASS BADGE & STATUS BADGE
   ========================================================================= */
export interface GlassBadgeProps {
  children: React.ReactNode
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'
  className?: string
}

const badgeVariants = {
  blue: 'bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border-[#0066FF]/20',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  red: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  slate: 'bg-slate-500/10 text-slate-700 dark:text-[#C0C6CF] border-slate-500/20',
}

export function GlassBadge({ children, variant = 'blue', className }: GlassBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        badgeVariants[variant] || badgeVariants.blue,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: 'active' | 'inactive' | 'pending' | 'success' | 'danger' | 'warning' | string
  label?: string
  className?: string
}) {
  const s = status?.toLowerCase()
  let variant: keyof typeof badgeVariants = 'slate'

  if (
    s === 'ativo' ||
    s === 'active' ||
    s === 'pago' ||
    s === 'confirmada' ||
    s === 'concluida' ||
    s === 'concluido' ||
    s === 'success'
  ) {
    variant = 'green'
  } else if (
    s === 'pendente' ||
    s === 'pending' ||
    s === 'warning' ||
    s === 'aguardando' ||
    s === 'rascunho'
  ) {
    variant = 'amber'
  } else if (
    s === 'cancelado' ||
    s === 'cancelada' ||
    s === 'bloqueado' ||
    s === 'inativo' ||
    s === 'inactive' ||
    s === 'danger' ||
    s === 'atrasado' ||
    s === 'zerado'
  ) {
    variant = 'red'
  } else if (s === 'master' || s === 'admin' || s === 'gerente') {
    variant = 'blue'
  }

  return (
    <GlassBadge variant={variant} className={className}>
      {label || status}
    </GlassBadge>
  )
}

/* =========================================================================
   11. EMPTY STATE
   ========================================================================= */
export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionIcon?: LucideIcon
  className?: string
}

export function EmptyState({
  icon: Icon = AlertCircle,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-8 sm:p-12 text-center flex flex-col items-center justify-center',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#0066FF]/10 dark:bg-[#0066FF]/15 text-[#0066FF] dark:text-[#3B82F6] flex items-center justify-center mb-4 border border-[#0066FF]/20 shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#C0C6CF] max-w-md mx-auto mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-medium rounded-xl h-10 px-4 shadow-sm flex items-center gap-2 cursor-pointer"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

/* =========================================================================
   12. SKELETON & ERROR STATES
   ========================================================================= */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 space-y-3">
      <div className="flex gap-4 pb-2 border-b border-slate-100 dark:border-[#1A294A]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 bg-slate-200 dark:bg-[#1A294A]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 flex-1 bg-slate-100 dark:bg-[#1A294A]/60 ${
                c === 0 ? 'w-1/3' : 'w-full'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ErrorState({
  title = 'Ocorreu um erro',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="glass-card rounded-2xl border border-rose-200 dark:border-rose-900/40 p-8 text-center flex flex-col items-center justify-center bg-rose-50/20 dark:bg-rose-950/20">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
      {message && (
        <p className="text-xs text-rose-600 dark:text-rose-300 max-w-md mx-auto mb-4">{message}</p>
      )}
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs rounded-xl h-9 gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar Novamente
        </Button>
      )}
    </div>
  )
}

/* =========================================================================
   13. SECTION HEADER
   ========================================================================= */
export function SectionHeader({
  title,
  description,
  badge,
  actions,
  className,
}: {
  title: string
  description?: string
  badge?: string | React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2',
        className,
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          {badge &&
            (typeof badge === 'string' ? (
              <Badge className="bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border-[#0066FF]/20 text-[10px] font-semibold">
                {badge}
              </Badge>
            ) : (
              badge
            ))}
        </div>
        {description && (
          <p className="text-xs text-slate-500 dark:text-[#C0C6CF] mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* =========================================================================
   14. PAGINATION (Padronizada)
   ========================================================================= */
export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}

export function GlassPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-[#1A294A] bg-slate-50/50 dark:bg-[#0A1328]/50 text-xs text-slate-600 dark:text-[#C0C6CF]',
        className,
      )}
    >
      <div>
        {totalItems !== undefined && pageSize !== undefined ? (
          <>
            Mostrando{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{' '}
            a{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {Math.min(totalItems, currentPage * pageSize)}
            </span>{' '}
            de <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span>{' '}
            registros
          </>
        ) : (
          <span>
            Página{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{currentPage}</span> de{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{safeTotalPages}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A] hover:bg-slate-100 dark:hover:bg-[#1A294A] cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Anterior
        </Button>
        <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {currentPage} / {safeTotalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
          disabled={currentPage >= safeTotalPages}
          className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A] hover:bg-slate-100 dark:hover:bg-[#1A294A] cursor-pointer"
        >
          Próxima
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// Alias para compatibilidade
export const Pagination = GlassPagination
