import React from 'react'
import { cn } from '@/lib/utils'

interface PrintDocumentProps {
  children: React.ReactNode
  className?: string
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({ children, className }) => {
  return (
    <div
      id="print-document"
      className={cn(
        'print-doc bg-white text-slate-900 w-full max-w-4xl mx-auto p-8 sm:p-10 text-[13px] leading-relaxed shadow-sm rounded-lg border border-slate-200 print:border-none print:shadow-none print:p-0 print:text-black print:max-w-none print:w-full',
        className,
      )}
    >
      {children}
    </div>
  )
}
