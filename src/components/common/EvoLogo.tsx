import React from 'react'
import { cn } from '@/lib/utils'

interface EvoHexagonLogoProps {
  className?: string
  size?: number | string
  withText?: boolean
  subtitle?: string
  textColor?: string
}

export function EvoHexagonLogo({
  className = '',
  size = 36,
  withText = false,
  subtitle = 'Gestão Empresarial',
  textColor = 'text-slate-900 dark:text-white',
}: EvoHexagonLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Hexagon Mark */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Hexagon Outer Gradient */}
            <linearGradient id="evoHexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0066FF" />
              <stop offset="50%" stopColor="#0A1328" />
              <stop offset="100%" stopColor="#0052CC" />
            </linearGradient>

            {/* Silver metallic inner stroke */}
            <linearGradient id="evoSilverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#C0C6CF" />
              <stop offset="70%" stopColor="#8E99A8" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>

            {/* Blue Glow Accent */}
            <radialGradient id="evoCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Hexagon Path */}
          <polygon
            points="50,4 92,27 92,73 50,96 8,73 8,27"
            fill="url(#evoHexGrad)"
            stroke="url(#evoSilverGrad)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Inner subtle glow */}
          <circle cx="50" cy="50" r="30" fill="url(#evoCenterGlow)" />

          {/* Modern EVO Geometric Crest: 3 futuristic dynamic bars / chevron */}
          {/* Top dynamic bar */}
          <path d="M 32 34 L 68 34 L 62 42 L 38 42 Z" fill="url(#evoSilverGrad)" />
          {/* Middle dynamic bar */}
          <path d="M 28 46 L 62 46 L 56 54 L 34 54 Z" fill="#0066FF" />
          {/* Bottom dynamic bar */}
          <path d="M 34 58 L 70 58 L 64 66 L 40 66 Z" fill="url(#evoSilverGrad)" />

          {/* Micro accent dot */}
          <circle cx="70" cy="50" r="3.5" fill="#00D2FF" />
        </svg>
      </div>

      {withText && (
        <div className="flex flex-col truncate leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-base font-extrabold tracking-tight', textColor)}>EVO</span>
            <span className="text-base font-semibold text-[#0066FF] tracking-tight">Gestão</span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-[#6E7785] dark:text-[#C0C6CF] font-medium tracking-wide uppercase">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
