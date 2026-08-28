import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface AnimatedNumberProps {
  value: string | number
  duration?: number // ms (padrão: 900ms)
  className?: string
  prefix?: string
  suffix?: string
  decimals?: number
}

interface ParsedNumber {
  targetNum: number
  prefix: string
  suffix: string
  isBrl: boolean
  isPercent: boolean
  decimals: number
  hasGrouping: boolean
}

export function parseNumberAndFormat(
  input: string | number,
  overrideDecimals?: number,
): ParsedNumber {
  if (typeof input === 'number') {
    const isDecimal = !Number.isInteger(input)
    const detectedDecimals = overrideDecimals !== undefined ? overrideDecimals : isDecimal ? 2 : 0
    return {
      targetNum: input,
      prefix: '',
      suffix: '',
      isBrl: false,
      isPercent: false,
      decimals: detectedDecimals,
      hasGrouping: false,
    }
  }

  const raw = String(input ?? '').trim()

  // Detect BRL currency: "R$ 1.250,50" or "-R$ 500,00"
  const isBrl = raw.includes('R$')
  // Detect Percentage: "25,5%" or "10%"
  const isPercent = raw.includes('%')

  // Clean for numeric parsing
  let clean = raw
    .replace(/R\$\s?/, '')
    .replace(/%/g, '')
    .trim()
  const isNegative = clean.startsWith('-') || raw.startsWith('-')
  clean = clean.replace(/^-/, '').trim()

  let targetNum = 0
  let decimals = overrideDecimals !== undefined ? overrideDecimals : 0
  let hasGrouping = false

  if (clean.includes(',') && clean.includes('.')) {
    // Ex: 1.234,56 -> 1234.56
    hasGrouping = true
    const parts = clean.split(',')
    if (overrideDecimals === undefined) {
      decimals = parts[1] ? parts[1].length : 0
    }
    targetNum = parseFloat(clean.replace(/\./g, '').replace(',', '.'))
  } else if (clean.includes(',')) {
    // Ex: 123,45 -> 123.45
    const parts = clean.split(',')
    if (overrideDecimals === undefined) {
      decimals = parts[1] ? parts[1].length : 0
    }
    targetNum = parseFloat(clean.replace(',', '.'))
  } else if (clean.includes('.')) {
    const parts = clean.split('.')
    if (parts.length > 2) {
      // Multiple dots -> thousand separators (ex: 1.250.000)
      hasGrouping = true
      targetNum = parseFloat(clean.replace(/\./g, ''))
      if (overrideDecimals === undefined) decimals = 0
    } else {
      if (overrideDecimals === undefined) {
        decimals = parts[1] ? parts[1].length : 0
      }
      targetNum = parseFloat(clean)
    }
  } else {
    targetNum = parseFloat(clean) || 0
    if (overrideDecimals === undefined) decimals = 0
  }

  if (isNaN(targetNum)) {
    targetNum = 0
  }

  if (isNegative) {
    targetNum = -targetNum
  }

  let prefix = ''
  let suffix = ''

  if (isBrl) {
    prefix = isNegative ? '-R$ ' : 'R$ '
  }
  if (isPercent) {
    suffix = '%'
  }

  return {
    targetNum: Math.abs(targetNum) * (isNegative ? -1 : 1),
    prefix,
    suffix,
    isBrl,
    isPercent,
    decimals,
    hasGrouping,
  }
}

export function formatAnimatedValue(
  current: number,
  isBrl: boolean,
  isPercent: boolean,
  decimals: number,
  prefix: string,
  suffix: string,
): string {
  if (isBrl) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: decimals >= 0 ? Math.max(decimals, 2) : 2,
      maximumFractionDigits: decimals >= 0 ? Math.max(decimals, 2) : 2,
    }).format(current)
  }

  if (isPercent) {
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals > 0 ? decimals : 0,
      maximumFractionDigits: Math.max(decimals, 1),
    }).format(current)
    return `${prefix}${formatted}%`
  }

  if (decimals > 0) {
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(current)
    return `${prefix}${formatted}${suffix}`
  }

  const formatted = new Intl.NumberFormat('pt-BR').format(Math.round(current))
  return `${prefix}${formatted}${suffix}`
}

export function AnimatedNumber({
  value,
  duration = 900,
  className,
  prefix: customPrefix,
  suffix: customSuffix,
  decimals: customDecimals,
}: AnimatedNumberProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  const initialParsed = parseNumberAndFormat(value, customDecimals)
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (isNaN(initialParsed.targetNum) || (typeof value === 'string' && !/\d/.test(value))) {
      return String(value ?? '0')
    }
    const finalPrefix = customPrefix ?? initialParsed.prefix
    const finalSuffix = customSuffix ?? initialParsed.suffix
    return formatAnimatedValue(
      initialParsed.targetNum,
      initialParsed.isBrl,
      initialParsed.isPercent,
      initialParsed.decimals,
      finalPrefix,
      finalSuffix,
    )
  })

  const prevTargetRef = useRef<number>(initialParsed.targetNum)
  const isFirstRun = useRef<boolean>(true)

  useEffect(() => {
    const parsed = parseNumberAndFormat(value, customDecimals)
    const target = parsed.targetNum

    if (isNaN(target) || (typeof value === 'string' && !/\d/.test(value))) {
      setDisplayValue(String(value ?? '0'))
      return
    }

    const startVal = isFirstRun.current ? 0 : prevTargetRef.current
    prevTargetRef.current = target
    isFirstRun.current = false

    // Se o valor de início for igual ao alvo e já estamos mostrando, garante sincronia
    if (startVal === target && !isFirstRun.current) {
      const finalPrefix = customPrefix ?? parsed.prefix
      const finalSuffix = customSuffix ?? parsed.suffix
      setDisplayValue(
        formatAnimatedValue(
          target,
          parsed.isBrl,
          parsed.isPercent,
          parsed.decimals,
          finalPrefix,
          finalSuffix,
        ),
      )
      return
    }

    let animationFrameId: number
    let startTime: number | null = null

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing suave (easeOutCubic)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = startVal + (target - startVal) * ease

      const finalPrefix = customPrefix ?? parsed.prefix
      const finalSuffix = customSuffix ?? parsed.suffix

      if (progress < 1) {
        setDisplayValue(
          formatAnimatedValue(
            current,
            parsed.isBrl,
            parsed.isPercent,
            parsed.decimals,
            finalPrefix,
            finalSuffix,
          ),
        )
        animationFrameId = requestAnimationFrame(animate)
      } else {
        // Garante precisão total no valor final
        setDisplayValue(
          formatAnimatedValue(
            target,
            parsed.isBrl,
            parsed.isPercent,
            parsed.decimals,
            finalPrefix,
            finalSuffix,
          ),
        )
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [value, duration, customPrefix, customSuffix, customDecimals])

  return (
    <span ref={containerRef} className={cn('tabular-nums inline-block', className)}>
      {displayValue}
    </span>
  )
}
export default AnimatedNumber
