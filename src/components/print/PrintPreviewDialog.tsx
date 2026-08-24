import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'

interface PrintPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
}

export const PrintPreviewDialog: React.FC<PrintPreviewDialogProps> = ({
  open,
  onOpenChange,
  title = 'Visualização de Impressão',
  children,
}) => {
  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-100 border-slate-300">
        <DialogHeader className="p-4 bg-white border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-teal-50 text-teal-700">
              <Printer className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-800">{title}</DialogTitle>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-teal-700 hover:bg-teal-800 text-white gap-2 h-9 px-4 font-medium shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/80">{children}</div>

        <DialogFooter className="p-3 bg-white border-t border-slate-200 flex sm:justify-between items-center text-xs text-slate-500">
          <span>Dica: Verifique a orientação (A4 Retrato) nas opções da impressora.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
