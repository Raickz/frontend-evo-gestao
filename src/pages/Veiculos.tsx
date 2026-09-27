import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { EntregasService, Veiculo } from '@/services/entregas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Truck, Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function VeiculosPage() {
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()

  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [veiculoEditando, setVeiculoEditando] = useState<Veiculo | null>(null)

  const [identificacao, setIdentificacao] = useState('')
  const [placa, setPlaca] = useState('')
  const [modelo, setModelo] = useState('')
  const [capacidadeCestas, setCapacidadeCestas] = useState('0')

  const carregarVeiculos = async () => {
    if (!empresa?.id) return
    setLoading(true)
    try {
      const { data, error } = await EntregasService.listarVeiculos(empresa.id)
      if (error) throw error
      setVeiculos(data || [])
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar veículos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarVeiculos()
  }, [empresa?.id])

  const abrirModalNovo = () => {
    setVeiculoEditando(null)
    setIdentificacao('')
    setPlaca('')
    setModelo('')
    setCapacidadeCestas('0')
    setModalOpen(true)
  }

  const abrirModalEditar = (veic: Veiculo) => {
    setVeiculoEditando(veic)
    setIdentificacao(veic.identificacao)
    setPlaca(veic.placa)
    setModelo(veic.modelo || '')
    setCapacidadeCestas(String(veic.capacidade_cestas || 0))
    setModalOpen(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresa?.id) return

    if (!identificacao.trim() || !placa.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe a identificação e a placa do veículo.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      if (veiculoEditando) {
        const { error } = await EntregasService.atualizarVeiculo(veiculoEditando.id, empresa.id, {
          identificacao: identificacao.trim(),
          placa: placa.trim().toUpperCase(),
          modelo: modelo.trim() || null,
          capacidade_cestas: Number(capacidadeCestas) || 0,
        })
        if (error) throw error
        toast({ title: 'Veículo atualizado com sucesso!' })
      } else {
        const { error } = await EntregasService.criarVeiculo({
          empresa_id: empresa.id,
          identificacao: identificacao.trim(),
          placa: placa.trim().toUpperCase(),
          modelo: modelo.trim() || null,
          capacidade_cestas: Number(capacidadeCestas) || 0,
        })
        if (error) throw error
        toast({ title: 'Veículo cadastrado com sucesso!' })
      }

      setModalOpen(false)
      carregarVeiculos()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar veículo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtivo = async (veic: Veiculo) => {
    if (!empresa?.id) return
    try {
      const { error } = await EntregasService.atualizarVeiculo(veic.id, empresa.id, {
        ativo: !veic.ativo,
      })
      if (error) throw error
      setVeiculos((prev) => prev.map((v) => (v.id === veic.id ? { ...v, ativo: !veic.ativo } : v)))
      toast({
        title: veic.ativo ? 'Veículo desativado' : 'Veículo ativado',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const podeGerenciar = ['master', 'admin', 'gerente'].includes(usuario?.perfil || '')

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#0066FF]" />
            Frota de Veículos
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#6E7785] mt-1">
            Cadastre e gerencie os veículos utilizados para despacho de rotas e entrega de cestas
          </p>
        </div>
        {podeGerenciar && (
          <Button
            onClick={abrirModalNovo}
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white min-h-[44px] px-4 font-semibold rounded-xl shadow-md cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-5 h-5 mr-1.5" />
            Novo Veículo
          </Button>
        )}
      </div>

      {/* Conteúdo Mobile-First (Grade de Cartões) */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0066FF]" />
        </div>
      ) : veiculos.length === 0 ? (
        <div className="bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-10 text-center space-y-3">
          <Truck className="w-12 h-12 text-slate-400 dark:text-[#6E7785] mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Nenhum veículo cadastrado
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#6E7785] max-w-sm mx-auto">
            Cadastre os carros, vans ou motos da sua empresa para vinculá-los às rotas de entrega.
          </p>
          {podeGerenciar && (
            <Button
              onClick={abrirModalNovo}
              className="mt-2 bg-[#0066FF] hover:bg-[#0052CC] text-white min-h-[44px] cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Cadastrar Primeiro Veículo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {veiculos.map((veic) => (
            <div
              key={veic.id}
              className="bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-5 shadow-sm space-y-4 hover:border-[#0066FF]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                    {veic.identificacao}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#111F38] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#1A2C50] font-semibold">
                      {veic.placa}
                    </span>
                    {veic.modelo && (
                      <span className="text-xs text-slate-500 dark:text-[#6E7785] truncate">
                        {veic.modelo}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => podeGerenciar && handleToggleAtivo(veic)}
                  disabled={!podeGerenciar}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1 transition-colors ${
                    veic.ativo
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {veic.ativo ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ativo
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      Inativo
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-100 dark:border-[#1A2C50] flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-[#6E7785]">Capacidade Máxima:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {veic.capacidade_cestas} cestas
                </span>
              </div>

              {podeGerenciar && (
                <div className="pt-1 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => abrirModalEditar(veic)}
                    className="flex-1 min-h-[44px] text-xs font-semibold rounded-xl border-slate-200 dark:border-[#152342] hover:bg-slate-100 dark:hover:bg-[#111F38] cursor-pointer"
                  >
                    Editar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar Veículo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              {veiculoEditando ? 'Editar Veículo' : 'Novo Veículo'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Identificação do Veículo *
              </Label>
              <Input
                value={identificacao}
                onChange={(e) => setIdentificacao(e.target.value)}
                placeholder="Ex: Fiorino Branca 01, Van Cestas"
                className="mt-1 min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Placa *
                </Label>
                <Input
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value)}
                  placeholder="BRA2E19"
                  className="mt-1 min-h-[44px] uppercase font-mono bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Modelo
                </Label>
                <Input
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: Fiat Fiorino"
                  className="mt-1 min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Capacidade de Cestas (unidades)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={capacidadeCestas}
                onChange={(e) => setCapacidadeCestas(e.target.value)}
                className="mt-1 min-h-[44px] font-mono bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]"
              />
              <p className="text-[11px] text-slate-500 dark:text-[#6E7785] mt-1">
                Limite máximo para travar sobrecarga ao carregar o veículo na rota.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#152342] flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => setModalOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="flex-1 min-h-[44px] bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl cursor-pointer"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Veículo'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
