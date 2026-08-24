import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Printer, X, Image as ImageIcon } from 'lucide-react'

interface PrintPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  showPhotos?: boolean
  onShowPhotosChange?: (value: boolean) => void
}

export const PrintPreviewDialog: React.FC<PrintPreviewDialogProps> = ({
  open,
  onOpenChange,
  title = 'Visualização de Impressão',
  children,
  showPhotos = false,
  onShowPhotosChange,
}) => {
  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-100 border-slate-300">
        <DialogHeader className="p-4 bg-white border-b border-slate-200 flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-teal-50 text-teal-700">
              <Printer className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-800">{title}</DialogTitle>
          </div>

          <div className="flex items-center gap-4">
            {onShowPhotosChange && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <Label
                  htmlFor="toggle-print-photos"
                  className="text-xs font-medium text-slate-700 cursor-pointer select-none"
                >
                  Imprimir com fotos dos produtos
                </Label>
                <Switch
                  id="toggle-print-photos"
                  checked={showPhotos}
                  onCheckedChange={onShowPhotosChange}
                />
              </div>
            )}

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
