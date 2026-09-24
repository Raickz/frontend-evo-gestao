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

/**
 * Retorna a forma correta no singular ou plural de acordo com o contador.
 * Ex: formatPlural(1, 'registro', 'registros') => '1 registro'
 *     formatPlural(5, 'item', 'itens') => '5 itens'
 */
export function formatPlural(count: number, singular: string, plural: string): string {
  const safeCount = Math.abs(count)
  return `${count} ${safeCount === 1 ? singular : plural}`
}

/**
 * Validação de CNPJ (14 dígitos, rejeição de repetidos, cálculo dos dígitos verificadores módulo 11).
 */
export function validarCnpj(cnpj: string): boolean {
  if (!cnpj) return false
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return false
  if (/^(\d)\1{13}$/.test(clean)) return false

  let tamanho = 12
  let numeros = clean.substring(0, tamanho)
  const digitos = clean.substring(tamanho)
  let soma = 0
  let pos = tamanho - 7

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false

  tamanho = 13
  numeros = clean.substring(0, tamanho)
  soma = 0
  pos = tamanho - 7
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  return resultado === parseInt(digitos.charAt(1), 10)
}

/**
 * Validação de e-mail com regex padrão.
 */
export function validarEmail(email: string): boolean {
  if (!email || !email.trim()) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Validação de telefone brasileiro (10 ou 11 dígitos limpos, fixo ou celular).
 */
export function validarTelefone(telefone: string): boolean {
  if (!telefone) return false
  const clean = telefone.replace(/\D/g, '')
  return clean.length === 10 || clean.length === 11
}

/**
 * Formata erros retornados da API / Supabase em mensagens claras e seguras para o usuário.
 */
export function formatApiError(err: unknown): string {
  if (!err) return 'Ocorreu um erro ao processar a solicitação. Tente novamente.'

  let message = ''
  if (typeof err === 'string') {
    message = err
  } else if (err instanceof Error) {
    message = err.message
  } else if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    if (typeof errorObj.message === 'string') {
      message = errorObj.message
    } else if (typeof errorObj.error_description === 'string') {
      message = errorObj.error_description
    } else if (typeof errorObj.details === 'string') {
      message = errorObj.details
    }
  }

  // 1. Mensagem contendo "Estoque insuficiente" -> manter original (já amigável)
  if (/estoque insuficiente/i.test(message)) {
    return message
  }

  // 2. Erros de RLS / PostgREST
  if (/pgrst/i.test(message) || /row-level security/i.test(message)) {
    return 'Permissão insuficiente para realizar esta operação.'
  }

  // 3. Falha de rede / conectividade
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message)) {
    return 'Falha na conexão com o servidor. Verifique sua internet.'
  }

  // 4. Chave duplicada
  if (/duplicate key/i.test(message)) {
    return 'Já existe um registro com estes dados.'
  }

  // Fallback seguro
  return 'Ocorreu um erro ao processar a solicitação. Tente novamente.'
}
