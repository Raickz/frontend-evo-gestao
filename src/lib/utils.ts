/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/**
 * Formatador oficial pt-BR BRL ("R$ 1.234,56")
 */
export function formatCurrency(val: number | string | null | undefined): string {
  const num = Number(val) || 0
  return brlFormatter.format(num)
}

export type EstoqueStatusType = 'sem_estoque' | 'abaixo_minimo' | 'no_limite' | 'normal'

export interface EstoqueStatusInfo {
  status: EstoqueStatusType
  label: string
  badgeVariant: 'destructive' | 'warning' | 'info' | 'success'
}

/**
 * Regra única de status de estoque do sistema:
 * - estoque = 0 → "Sem estoque"
 * - estoque < mínimo → "Abaixo do mínimo"
 * - estoque = mínimo → "No limite"
 * - estoque > mínimo → "Normal"
 */
export function getEstoqueStatusInfo(quantidade: number, estoqueMinimo: number): EstoqueStatusInfo {
  const qtd = Number(quantidade) || 0
  const min = Number(estoqueMinimo) || 0

  if (qtd <= 0) {
    return {
      status: 'sem_estoque',
      label: 'Sem estoque',
      badgeVariant: 'destructive',
    }
  }

  if (qtd < min) {
    return {
      status: 'abaixo_minimo',
      label: 'Abaixo do mínimo',
      badgeVariant: 'destructive',
    }
  }

  if (qtd === min) {
    return {
      status: 'no_limite',
      label: 'No limite',
      badgeVariant: 'warning',
    }
  }

  return {
    status: 'normal',
    label: 'Normal',
    badgeVariant: 'success',
  }
}
