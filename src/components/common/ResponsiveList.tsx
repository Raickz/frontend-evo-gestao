import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface ResponsiveCardItem {
  id: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  valueHighlight?: React.ReactNode
  infoRows?: Array<{
    label: string
    value: React.ReactNode
  }>
  actions?: React.ReactNode
  onClick?: () => void
}

interface ResponsiveListProps<T> {
  items: T[]
  loading?: boolean
  loadingRows?: number
  renderCard: (item: T, index: number) => ResponsiveCardItem
  renderTable: () => React.ReactNode
  emptyState?: React.ReactNode
  className?: string
}

export function ResponsiveList<T>({
  items,
  loading = false,
  loadingRows = 5,
  renderCard,
  renderTable,
  emptyState,
  className = '',
}: ResponsiveListProps<T>) {
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Mobile Skeleton */}
        <div className="block md:hidden space-y-3">
          {Array.from({ length: loadingRows }).map((_, i) => (
            <Card
              key={i}
              className="p-4 space-y-3 bg-white dark:bg-[#0A1328] border-slate-200/80 dark:border-[#1A294A] rounded-2xl"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32 rounded-lg" />
                  <Skeleton className="h-3 w-24 rounded-lg" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-1 pt-1">
                <Skeleton className="h-3 w-full rounded-lg" />
                <Skeleton className="h-3 w-2/3 rounded-lg" />
              </div>
              <div className="pt-2 flex justify-between items-center border-t border-slate-100 dark:border-[#1A294A]">
                <Skeleton className="h-5 w-20 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-xl" />
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop Table Skeleton */}
        <div className="hidden md:block">
          <div className="p-4 space-y-3 glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A]">
            {Array.from({ length: loadingRows }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className={className}>
      {/* Mobile Card List (< 768px) */}
      <div className="block md:hidden space-y-3">
        {items.map((item, index) => {
          const card = renderCard(item, index)
          return (
            <div
              key={card.id}
              onClick={card.onClick}
              className={`p-4 rounded-2xl bg-white dark:bg-[#0A1328] border border-slate-200/80 dark:border-[#1A294A] shadow-xs space-y-2.5 transition-all ${
                card.onClick ? 'cursor-pointer active:scale-[0.99] hover:border-[#0066FF]/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {card.title}
                  </div>
                  {card.subtitle && (
                    <div className="text-xs text-slate-500 dark:text-[#8E99A8] mt-0.5 truncate">
                      {card.subtitle}
                    </div>
                  )}
                </div>
                {card.badge && <div className="shrink-0">{card.badge}</div>}
              </div>

              {card.infoRows && card.infoRows.length > 0 && (
                <div className="space-y-1 pt-1 text-xs text-slate-600 dark:text-[#C0C6CF]">
                  {card.infoRows.map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-[#8E99A8]">{row.label}:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(card.valueHighlight || card.actions) && (
                <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-[#1A294A]">
                  <div className="min-w-0">
                    {card.valueHighlight && (
                      <div className="font-black text-slate-900 dark:text-white text-base">
                        {card.valueHighlight}
                      </div>
                    )}
                  </div>
                  {card.actions && (
                    <div
                      className="shrink-0 flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {card.actions}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block">{renderTable()}</div>
    </div>
  )
}
