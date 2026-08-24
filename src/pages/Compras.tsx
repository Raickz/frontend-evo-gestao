import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  PageHeader,
  MetricCard,
  TableSkeleton,
  ErrorState,
  EmptyState,
} from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import {
  ComprasService,
  Compra,
  ComprasIndicadores,
  FornecedorOption,
  ProdutoDisponivelOption,
  ItemCompraInput,
} from '@/services/compras'
import { toast } from 'sonner'
import {
  ShoppingCart,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  X,
  Eye,
  CheckCircle2,
  XCircle,
  Edit,
  Clock,
  Trash2,
  AlertTriangle,
  FileText,
  DollarSign,
  Package,
  CreditCard,
  ExternalLink,
  Printer,
} from 'lucide-react'
import { PrintPreviewDialog } from '@/components/print/PrintPreviewDialog'
import { CompraPrintDocument } from '@/components/print/CompraPrintDocument'

type StatusFilter = 'todos' | 'rascunho' | 'confirmada' | 'cancelada'

const PAGE_SIZE = 20

  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  // =========================================================================
  // AUXILIARES
=======
  // =========================================================================
  // AUXILIARES
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  // ESTADO DA LISTAGEM & INDICADORES
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  // ESTADO DA LISTAGEM & INDICADORES
=======
export default function ComprasPage() {
  const { empresaId, empresa } = useEmpresa()
  const { usuario } = useAuth()

  const perfil = usuario?.perfil?.toLowerCase()
  const podeCriar =
    perfil === 'master' || perfil === 'admin' || perfil === 'gerente' || perfil === 'operador'

  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  // =========================================================================
  // AUXILIARES
=======
  // =========================================================================
  // AUXILIARES
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  // ESTADO DA LISTAGEM & INDICADORES
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  // ESTADO DA LISTAGEM & INDICADORES
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  // ESTADO DA LISTAGEM & INDICADORES
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }

  // =========================================================================
  // ESTADO DA LISTAGEM & INDICADORES
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  // ESTADO DA LISTAGEM & INDICADORES
  // =========================================================================
  const [compras, setCompras] = useState<any[]>([])
  const [totalComprasCount, setTotalComprasCount] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [errorList, setErrorList] = useState<string | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [page, setPage] = useState(1)

  // KPIs
  const [indicadores, setIndicadores] = useState<ComprasIndicadores>({
    totalCompras: 0,
    valorCompras: 0,
    comprasConfirmadas: 0,
    comprasPendentes: 0,
  })
  const [loadingIndicadores, setLoadingIndicadores] = useState(true)

  // Debounce busca (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Carregar Indicadores
  const loadIndicadores = useCallback(async () => {
    if (!empresaId) return
    setLoadingIndicadores(true)
    try {
      const { data, error } = await ComprasService.getIndicadores(empresaId)
      if (error) throw error
      if (data) {
        setIndicadores(data)
      }
    } catch {
      // Ignora erro silenciosamente nos KPIs
    } finally {
      setLoadingIndicadores(false)
    }
  }, [empresaId])

  // Carregar Compras
  const loadCompras = useCallback(async () => {
    if (!empresaId) return
    setLoadingList(true)
    setErrorList(null)
    try {
      const filters = {
        search: debouncedSearch,
        status: statusFilter,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        page,
        pageSize: PAGE_SIZE,
      }

      const [listRes, countRes] = await Promise.all([
        ComprasService.list(empresaId, filters),
        ComprasService.count(empresaId, filters),
      ])

      if (listRes.error) throw listRes.error
      if (countRes.error) throw countRes.error

      setCompras(listRes.data || [])
      setTotalComprasCount(countRes.count || 0)
    } catch (e: any) {
      console.error('Erro ao listar compras:', e)
      setErrorList(e.message || 'Falha ao carregar compras.')
    } finally {
      setLoadingList(false)
    }
  }, [empresaId, debouncedSearch, statusFilter, dataInicio, dataFim, page])

  useEffect(() => {
    loadIndicadores()
  }, [loadIndicadores])

  useEffect(() => {
    loadCompras()
  }, [loadCompras])

  // =========================================================================
  // SUPORTE: Fornecedores & Produtos Ativos
  // =========================================================================
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([])
  const [produtos, setProdutos] = useState<ProdutoDisponivelOption[]>([])
  const [loadingSuporte, setLoadingSuporte] = useState(false)

  const carregarDadosSuporte = async () => {
    if (!empresaId) return
    setLoadingSuporte(true)
    try {
      const [fornRes, prodRes] = await Promise.all([
        ComprasService.listFornecedoresAtivos(empresaId),
        ComprasService.listProdutosDisponiveis(empresaId),
      ])
      if (fornRes.error) throw fornRes.error
      if (prodRes.error) throw prodRes.error
      setFornecedores((fornRes.data as unknown as FornecedorOption[]) || [])
      setProdutos((prodRes.data as unknown as ProdutoDisponivelOption[]) || [])
    } catch {
      toast.error('Erro ao carregar dados de fornecedores e produtos.')
    } finally {
      setLoadingSuporte(false)
    }
  }

  // =========================================================================
  // MODAL: NOVA COMPRA
  // =========================================================================
  const [modalNovaAberta, setModalNovaAberta] = useState(false)
  const [fornecedorId, setFornecedorId] = useState('')
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0])
  const [formaPagamento, setFormaPagamento] = useState<'a_prazo' | 'pago'>('a_prazo')
  const [vencimento, setVencimento] = useState('')
  const [valorPago, setValorPago] = useState('0')
  const [observacoes, setObservacoes] = useState('')
  const [itensForm, setItensForm] = useState<ItemLinhaForm[]>([])
  const [submittingNova, setSubmittingNova] = useState(false)
  const [buscaFornecedorModal, setBuscaFornecedorModal] = useState('')

  const abrirModalNovaCompra = () => {
    if (!podeCriar) {
      toast.error('Você não possui permissão para cadastrar compras.')
      return
    }
    setFornecedorId('')
    setDataCompra(new Date().toISOString().split('T')[0])
    setFormaPagamento('a_prazo')
    // Vencimento default: hoje + 30 dias
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setVencimento(d.toISOString().split('T')[0])
    setValorPago('0')
    setObservacoes('')
    setItensForm([])
    setBuscaFornecedorModal('')
    carregarDadosSuporte()
    setModalNovaAberta(true)
  }

  const adicionarLinhaItem = () => {
    setItensForm((prev) => [
      ...prev,
      {
        produto_id: '',
        nome: '',
        codigo: null,
        unidade: 'UN',
        saldo_atual: 0,
        preco_custo: 0,
        quantidade: 1,
        preco_unitario: 0,
        subtotal: 0,
      },
    ])
  }

  const handleSelectProdutoItem = (index: number, prodId: string) => {
    const prod = produtos.find((p) => p.id === prodId)
    if (!prod) return
    const saldo = prod.estoques?.[0]?.quantidade ?? 0
    const custo = Number(prod.preco_custo) || 0

    setItensForm((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const qtd = current.quantidade > 0 ? current.quantidade : 1
      const preco = custo >= 0 ? custo : 0
      const sub = Math.round(qtd * preco * 100) / 100

      copy[index] = {
        produto_id: prod.id,
        nome: prod.nome,
        codigo: prod.codigo,
        unidade: prod.unidade || 'UN',
        saldo_atual: saldo,
        preco_custo: custo,
        quantidade: qtd,
        preco_unitario: preco,
        subtotal: sub,
      }
      return copy
    })
  }

  const handleUpdateItemQuantidade = (index: number, qtdStr: string) => {
    const qtdNum = parseFloat(qtdStr.replace(',', '.'))
    const qtd = isNaN(qtdNum) ? 0 : qtdNum
    setItensForm((prev) => {
      const copy = [...prev]
      const item = copy[index]
      const sub = Math.round(qtd * item.preco_unitario * 100) / 100
      copy[index] = { ...item, quantidade: qtd, subtotal: sub }
      return copy
    })
  }

  const handleUpdateItemPreco = (index: number, precoStr: string) => {
    const precoNum = parseFloat(precoStr.replace(',', '.'))
    const preco = isNaN(precoNum) ? 0 : precoNum
    setItensForm((prev) => {
      const copy = [...prev]
      const item = copy[index]
      const sub = Math.round(item.quantidade * preco * 100) / 100
      copy[index] = { ...item, preco_unitario: preco, subtotal: sub }
      return copy
    })
  }

  const removerLinhaItem = (index: number) => {
    setItensForm((prev) => prev.filter((_, i) => i !== index))
  }

  const totalNovaCompra = useMemo(() => {
    return itensForm.reduce((acc, item) => acc + (item.subtotal || 0), 0)
  }, [itensForm])

  // Submit Nova Compra (via RPC criar_compra)
  const handleSubmitNovaCompra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId) return

    if (!fornecedorId) {
      toast.error('Selecione o fornecedor da compra.')
      return
    }

    if (itensForm.length === 0) {
      toast.error('Adicione pelo menos um produto à compra.')
      return
    }

    // Validar itens
    for (let i = 0; i < itensForm.length; i++) {
      const it = itensForm[i]
      if (!it.produto_id) {
        toast.error(`Item #${i + 1}: Selecione um produto.`)
        return
      }
      if (it.quantidade <= 0) {
        toast.error(`Item #${i + 1} (${it.nome || 'Produto'}): A quantidade deve ser maior que 0.`)
        return
      }
      if (it.preco_unitario < 0) {
        toast.error(
          `Item #${i + 1} (${it.nome || 'Produto'}): O preço unitário não pode ser negativo.`,
        )
        return
      }
    }

    setSubmittingNova(true)
    try {
      const valorPagoNum =
        formaPagamento === 'pago'
          ? parseFloat(valorPago.replace(',', '.')) || totalNovaCompra
          : parseFloat(valorPago.replace(',', '.')) || 0

      const payload = {
        fornecedor_id: fornecedorId,
        itens: itensForm.map((it) => ({
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
        })),
        observacoes: observacoes.trim() || '',
        data_compra: dataCompra,
        forma_pagamento: formaPagamento,
        vencimento: formaPagamento === 'a_prazo' ? vencimento || null : null,
        valor_pago: valorPagoNum,
      }

      const { data, error } = await ComprasService.criarCompra(empresaId, payload)
      if (error) throw error

      const res: any = data
      if (res && res.sucesso === false) {
        throw new Error(res.erro || res.mensagem || 'Falha ao criar compra.')
      }

      const numCompra = res?.numero ? `#${res.numero}` : ''
      toast.success(`Compra ${numCompra} salva como rascunho com sucesso!`)
      setModalNovaAberta(false)
      loadIndicadores()
      loadCompras()
    } catch (err: any) {
      console.error('Erro ao salvar compra:', err)
      toast.error(err.message || 'Falha ao registrar compra.')
    } finally {
      setSubmittingNova(false)
    }
  }

  // =========================================================================
  // MODAL: EDITAR COMPRA (Apenas rascunho)
  // =========================================================================
  const [modalEditarAberta, setModalEditarAberta] = useState(false)
  const [editCompraId, setEditCompraId] = useState('')
  const [editNumeroCompra, setEditNumeroCompra] = useState<number | null>(null)
  const [editFornecedorId, setEditFornecedorId] = useState('')
  const [editDataCompra, setEditDataCompra] = useState('')
  const [editFormaPagamento, setEditFormaPagamento] = useState<'a_prazo' | 'pago'>('a_prazo')
  const [editVencimento, setEditVencimento] = useState('')
  const [editValorPago, setEditValorPago] = useState('0')
  const [editObservacoes, setEditObservacoes] = useState('')
  const [editItensForm, setEditItensForm] = useState<ItemLinhaForm[]>([])
  const [submittingEditar, setSubmittingEditar] = useState(false)
  const [loadingEditarData, setLoadingEditarData] = useState(false)

  const abrirModalEditar = async (compraId: string) => {
    if (!empresaId) return
    setLoadingEditarData(true)
    setModalEditarAberta(true)
    try {
      await carregarDadosSuporte()
      const { data: cData, error: cErr } = await ComprasService.getById(empresaId, compraId)
      if (cErr) throw cErr
      if (!cData) throw new Error('Compra não encontrada.')

      if (cData.status !== 'rascunho') {
        toast.error('Apenas compras com status "rascunho" podem ser editadas.')
        setModalEditarAberta(false)
        return
      }

      setEditCompraId(cData.id)
      setEditNumeroCompra(cData.numero)
      setEditFornecedorId(cData.fornecedor_id)
      setEditDataCompra(cData.data_compra || new Date().toISOString().split('T')[0])
      setEditFormaPagamento(cData.forma_pagamento === 'pago' ? 'pago' : 'a_prazo')
      setEditVencimento(cData.vencimento || '')
      setEditValorPago(String(cData.valor_pago || 0))
      setEditObservacoes(cData.observacoes || '')

      // Mapear itens
      const mappedItens: ItemLinhaForm[] = (cData.itens_compra || []).map((it: any) => ({
        produto_id: it.produto_id,
        nome: it.produtos?.nome || 'Produto',
        codigo: it.produtos?.codigo || null,
        unidade: it.produtos?.unidade || 'UN',
        saldo_atual: 0,
        preco_custo: Number(it.produtos?.preco_custo) || 0,
        quantidade: Number(it.quantidade) || 1,
        preco_unitario: Number(it.preco_unitario) || 0,
        subtotal: Number(it.subtotal) || 0,
      }))
      setEditItensForm(mappedItens)
    } catch (e: any) {
      toast.error(e.message || 'Falha ao carregar dados da compra.')
      setModalEditarAberta(false)
    } finally {
      setLoadingEditarData(false)
    }
  }

  const totalEditCompra = useMemo(() => {
    return editItensForm.reduce((acc, item) => acc + (item.subtotal || 0), 0)
  }, [editItensForm])

  const handleSelectProdutoEditItem = (index: number, prodId: string) => {
    const prod = produtos.find((p) => p.id === prodId)
    if (!prod) return
    const saldo = prod.estoques?.[0]?.quantidade ?? 0
    const custo = Number(prod.preco_custo) || 0

    setEditItensForm((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const qtd = current.quantidade > 0 ? current.quantidade : 1
      const preco = custo >= 0 ? custo : 0
      const sub = Math.round(qtd * preco * 100) / 100

      copy[index] = {
        produto_id: prod.id,
        nome: prod.nome,
        codigo: prod.codigo,
        unidade: prod.unidade || 'UN',
        saldo_atual: saldo,
        preco_custo: custo,
        quantidade: qtd,
        preco_unitario: preco,
        subtotal: sub,
      }
      return copy
    })
  }

  const handleUpdateEditItemQuantidade = (index: number, qtdStr: string) => {
    const qtdNum = parseFloat(qtdStr.replace(',', '.'))
    const qtd = isNaN(qtdNum) ? 0 : qtdNum
    setEditItensForm((prev) => {
      const copy = [...prev]
      const item = copy[index]
      const sub = Math.round(qtd * item.preco_unitario * 100) / 100
      copy[index] = { ...item, quantidade: qtd, subtotal: sub }
      return copy
    })
  }

  const handleUpdateEditItemPreco = (index: number, precoStr: string) => {
    const precoNum = parseFloat(precoStr.replace(',', '.'))
    const preco = isNaN(precoNum) ? 0 : precoNum
    setEditItensForm((prev) => {
      const copy = [...prev]
      const item = copy[index]
      const sub = Math.round(item.quantidade * preco * 100) / 100
      copy[index] = { ...item, preco_unitario: preco, subtotal: sub }
      return copy
    })
  }

  const removerEditLinhaItem = (index: number) => {
    setEditItensForm((prev) => prev.filter((_, i) => i !== index))
  }

  const adicionarEditLinhaItem = () => {
    setEditItensForm((prev) => [
      ...prev,
      {
        produto_id: '',
        nome: '',
        codigo: null,
        unidade: 'UN',
        saldo_atual: 0,
        preco_custo: 0,
        quantidade: 1,
        preco_unitario: 0,
        subtotal: 0,
      },
    ])
  }

  const handleSubmitSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId || !editCompraId) return

    if (!editFornecedorId) {
      toast.error('Selecione o fornecedor.')
      return
    }

    if (editItensForm.length === 0) {
      toast.error('A compra precisa ter pelo menos um item.')
      return
    }

    for (let i = 0; i < editItensForm.length; i++) {
      const it = editItensForm[i]
      if (!it.produto_id) {
        toast.error(`Item #${i + 1}: Selecione um produto.`)
        return
      }
      if (it.quantidade <= 0) {
        toast.error(`Item #${i + 1}: Quantidade deve ser maior que 0.`)
        return
      }
      if (it.preco_unitario < 0) {
        toast.error(`Item #${i + 1}: Preço não pode ser negativo.`)
        return
      }
    }

    setSubmittingEditar(true)
    try {
      const valorPagoNum =
        editFormaPagamento === 'pago'
          ? parseFloat(editValorPago.replace(',', '.')) || totalEditCompra
          : parseFloat(editValorPago.replace(',', '.')) || 0

      await ComprasService.update(empresaId, editCompraId, {
        fornecedor_id: editFornecedorId,
        observacoes: editObservacoes.trim() || null,
        data_compra: editDataCompra,
        forma_pagamento: editFormaPagamento,
        vencimento: editFormaPagamento === 'a_prazo' ? editVencimento || null : null,
        valor_pago: valorPagoNum,
        itens: editItensForm.map((it) => ({
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
        })),
      })

      toast.success(`Compra #${editNumeroCompra} atualizada com sucesso!`)
      setModalEditarAberta(false)
      loadIndicadores()
      loadCompras()
    } catch (err: any) {
      console.error('Erro ao atualizar compra:', err)
      toast.error(err.message || 'Falha ao atualizar compra.')
    } finally {
      setSubmittingEditar(false)
    }
  }

  // =========================================================================
  // MODAL: CONFIRMAR COMPRA (Atômica via RPC confirmar_compra)
  // =========================================================================
  const [modalConfirmarAberta, setModalConfirmarAberta] = useState(false)
  const [compraParaConfirmar, setCompraParaConfirmar] = useState<any | null>(null)
  const [submittingConfirmar, setSubmittingConfirmar] = useState(false)

  const abrirModalConfirmar = async (compra: any) => {
    if (!podeCriar) {
      toast.error('Você não tem permissão para confirmar compras.')
      return
    }
    if (compra.status !== 'rascunho') {
      toast.error('Apenas compras em rascunho podem ser confirmadas.')
      return
    }

    // Carregar detalhes completos para exibir resumo
    try {
      const { data, error } = await ComprasService.getById(empresaId!, compra.id)
      if (error) throw error
      setCompraParaConfirmar(data)
      setModalConfirmarAberta(true)
    } catch {
      setCompraParaConfirmar(compra)
      setModalConfirmarAberta(true)
    }
  }

  const handleExecutarConfirmacao = async () => {
    if (!compraParaConfirmar?.id) return
    setSubmittingConfirmar(true)
    try {
      const { data, error } = await ComprasService.confirmarCompra(compraParaConfirmar.id)
      if (error) throw error

      const res: any = data
      if (res && res.sucesso === false) {
        throw new Error(res.erro || res.mensagem || 'Falha ao confirmar compra.')
      }

      toast.success(
        `Compra #${compraParaConfirmar.numero} confirmada! Estoque atualizado e movimentações geradas.`,
      )
      setModalConfirmarAberta(false)
      setCompraParaConfirmar(null)
      loadIndicadores()
      loadCompras()
    } catch (err: any) {
      console.error('Erro ao confirmar compra:', err)
      toast.error(err.message || 'Falha ao confirmar compra.')
    } finally {
      setSubmittingConfirmar(false)
    }
  }

  // =========================================================================
  // MODAL: CANCELAR COMPRA (Rascunho)
  // =========================================================================
  const [modalCancelarAberta, setModalCancelarAberta] = useState(false)
  const [compraParaCancelar, setCompraParaCancelar] = useState<any | null>(null)
  const [submittingCancelar, setSubmittingCancelar] = useState(false)

  const abrirModalCancelar = (compra: any) => {
    if (!podeCriar) {
      toast.error('Você não possui permissão para cancelar compras.')
      return
    }
    setCompraParaCancelar(compra)
    setModalCancelarAberta(true)
  }

  const handleExecutarCancelamento = async () => {
    if (!empresaId || !compraParaCancelar?.id) return
    setSubmittingCancelar(true)
    try {
      const { error } = await ComprasService.cancelar(empresaId, compraParaCancelar.id)
      if (error) throw error

      toast.success(`Compra #${compraParaCancelar.numero} cancelada com sucesso.`)
      setModalCancelarAberta(false)
      setCompraParaCancelar(null)
      loadIndicadores()
      loadCompras()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao cancelar compra.')
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // AUXILIARES=========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }
=======
  // =========================================================================
  // MODAL: DETALHES DA COMPRA & IMPRESSÃO
  // =========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printCompraAberto, setPrintCompraAberto] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const abrirImpressaoCompra = async (compraId: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      if (!data) throw new Error('Compra não encontrada.')
      setCompraDetalhe(data)
      setPrintCompraAberto(true)
    } catch (e: any) {
      console.error('Erro ao preparar impressão de compra:', e)
      toast.error(e.message || 'Falha ao carregar dados da compra para impressão.')
    }
  }=========================================================================
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false)
  const [compraDetalhe, setCompraDetalhe] = useState<any | null>(null)
  const [contaPagarDetalhe, setContaPagarDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (compraId: string) => {
    if (!empresaId) return
    setModalDetalhesAberta(true)
    setLoadingDetalhes(true)
    setContaPagarDetalhe(null)
    try {
      const { data, error } = await ComprasService.getById(empresaId, compraId)
      if (error) throw error
      setCompraDetalhe(data)

      if (data && data.status === 'confirmada') {
        const { data: cpData } = await ComprasService.getContaPagarPorCompra(
          empresaId,
          data.fornecedor_id,
          data.numero,
        )
        if (cpData) {
          setContaPagarDetalhe(cpData)
        }
      }
    } catch (e: any) {
      console.error('Erro ao carregar detalhes da compra:', e)
      toast.error('Falha ao carregar detalhes da compra.')
      setModalDetalhesAberta(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  // =========================================================================
  // AUXILIARES
  // =========================================================================
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    // Se vier no formato yyyy-mm-dd
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmada':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
          >
            Confirmada
          </Badge>
        )
      case 'rascunho':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 font-semibold"
          >
            Rascunho
          </Badge>
        )
      case 'cancelada':
        return (
          <Badge
            variant="outline"
            className="bg-rose-50 text-rose-700 border-rose-200 font-semibold"
          >
            Cancelada
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
            {status}
          </Badge>
        )
    }
  }

  const limparFiltros = () => {
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('todos')
    setDataInicio('')
    setDataFim('')
    setPage(1)
  }

  const temFiltroAtivo =
    debouncedSearch !== '' || statusFilter !== 'todos' || dataInicio !== '' || dataFim !== ''

  const totalPaginas = Math.ceil(totalComprasCount / PAGE_SIZE) || 1

  // Filtro de fornecedores dentro do modal
  const fornecedoresFiltradosModal = useMemo(() => {
    if (!buscaFornecedorModal.trim()) return fornecedores
    const termo = buscaFornecedorModal.toLowerCase()
    return fornecedores.filter(
      (f) => f.nome.toLowerCase().includes(termo) || (f.documento && f.documento.includes(termo)),
    )
  }, [fornecedores, buscaFornecedorModal])

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Gestão de Compras"
        description="Controle de pedidos de compra a fornecedores, entrada de produtos e atualização de custos."
        actions={
          podeCriar && (
            <Button
              onClick={abrirModalNovaCompra}
              className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm font-medium text-xs h-9"
            >
              <Plus className="w-4 h-4" /> Nova Compra
            </Button>
          )
        }
      />

      {/* 2. KPIs (4 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {loadingIndicadores ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`kpi-skeleton-${i}`}
                className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs"
              >
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </>
        ) : (
          <>
            <MetricCard
              title="Compras no Período"
              value={String(indicadores.totalCompras)}
              subtitle="Total de registros de compras"
              icon={ShoppingCart}
            />

            <MetricCard
              title="Valor Comprado"
              value={formatCurrency(indicadores.valorCompras)}
              subtitle="Soma total das compras"
              icon={DollarSign}
            />

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Confirmadas
                </span>
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-emerald-900 tabular-nums">
                {indicadores.comprasConfirmadas}
              </div>
              <p className="text-xs text-emerald-600 mt-1">Estoque atualizado</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Pendentes
                </span>
                <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-amber-900 tabular-nums">
                {indicadores.comprasPendentes}
              </div>
              <p className="text-xs text-amber-600 mt-1">Aguardando confirmação</p>
            </div>
          </>
        )}
      </div>

      {/* 3. Filtros */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* Busca textual */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por fornecedor, nº da compra ou obs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 text-xs h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Select Status */}
          <div>
            <Select
              value={statusFilter}
              onValueChange={(val: StatusFilter) => {
                setStatusFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="text-xs h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os status
                </SelectItem>
                <SelectItem value="rascunho" className="text-xs text-amber-600 font-medium">
                  Rascunhos
                </SelectItem>
                <SelectItem value="confirmada" className="text-xs text-emerald-600 font-medium">
                  Confirmadas
                </SelectItem>
                <SelectItem value="cancelada" className="text-xs text-rose-600 font-medium">
                  Canceladas
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Período: De */}
          <div>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value)
                setPage(1)
              }}
              className="text-xs h-9 bg-slate-50 border-slate-200"
              title="Data inicial"
            />
          </div>

          {/* Período: Até */}
          <div>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value)
                setPage(1)
              }}
              className="text-xs h-9 bg-slate-50 border-slate-200"
              title="Data final"
            />
          </div>
        </div>

        {temFiltroAtivo && (
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 h-7"
            >
              <X className="w-3 h-3" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* 4. Tabela de Compras ou Estados */}
      {loadingList ? (
        <TableSkeleton rows={5} cols={7} />
      ) : errorList ? (
        <ErrorState message={errorList} onRetry={loadCompras} />
      ) : compras.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={temFiltroAtivo ? 'Nenhuma compra encontrada' : 'Nenhuma compra cadastrada'}
          description={
            temFiltroAtivo
              ? 'Nenhuma compra corresponde aos filtros informados. Ajuste os termos da busca.'
              : 'Cadastre ordens de compra a fornecedores para gerenciar estoque e contas a pagar.'
          }
          actionLabel={temFiltroAtivo ? 'Limpar Filtros' : podeCriar ? 'Nova Compra' : undefined}
          onAction={temFiltroAtivo ? limparFiltros : podeCriar ? abrirModalNovaCompra : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Nº Compra</th>
                  <th className="py-3.5 px-4">Fornecedor</th>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Pagamento</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compras.map((compra) => {
                  const isRascunho = compra.status === 'rascunho'
                  const formaPagtoLabel =
                    compra.forma_pagamento === 'pago' ? 'À Vista / Pago' : 'A Prazo'

                  return (
                    <tr
                      key={compra.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => abrirDetalhes(compra.id)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{compra.numero}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {compra.fornecedores?.nome || (
                          <span className="text-slate-400 font-normal italic">
                            Fornecedor não identificado
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(compra.data_compra || compra.created_at)}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums text-right text-sm">
                        {formatCurrency(compra.total || 0)}
                      </td>

                      <td className="py-3 px-4 text-center">{getStatusBadge(compra.status)}</td>

                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-slate-800">{formaPagtoLabel}</div>
                        {compra.forma_pagamento === 'a_prazo' && compra.vencimento && (
                          <div className="text-[10px] text-slate-500">
                            Venc: {formatDate(compra.vencimento)}
                          </div>
                        )}
                        {compra.forma_pagamento === 'pago' && compra.valor_pago > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Pago: {formatCurrency(compra.valor_pago)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ações por status */}
                          {isRascunho && podeCriar && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirModalConfirmar(compra)}
                                className="h-8 text-[11px] px-2.5 border-teal-600 text-teal-700 hover:bg-teal-50 hover:text-teal-800 font-medium flex items-center gap-1"
                                title="Confirmar Compra e atualizar estoque"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                Confirmar
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirModalEditar(compra.id)}
                                className="h-8 text-[11px] px-2 text-slate-700 hover:text-teal-700"
                                title="Editar Rascunho"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirModalCancelar(compra)}
                                className="h-8 text-[11px] px-2 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                title="Cancelar Compra"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {/* Botão Visualizar sempre disponível */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirDetalhes(compra.id)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                            title="Visualizar Detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* Botão Imprimir Compra */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirImpressaoCompra(compra.id)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-teal-700"
                            title="Imprimir Ordem de Compra"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="py-3 px-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {Math.min((page - 1) * PAGE_SIZE + 1, totalComprasCount)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(page * PAGE_SIZE, totalComprasCount)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{totalComprasCount}</span> compras
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs px-2 font-medium">
                Página {page} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPaginas}
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DIALOG 1: NOVA COMPRA
          ========================================================================= */}
      <Dialog open={modalNovaAberta} onOpenChange={setModalNovaAberta}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShoppingCart className="w-5 h-5 text-teal-700" />
              Nova Ordem de Compra
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre os itens e dados da compra com o fornecedor. A compra será salva como
              rascunho para conferência.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitNovaCompra} className="space-y-6 pt-2">
            {/* Step 1 — Dados Gerais */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                1. Dados Gerais do Pedido
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Fornecedor */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Fornecedor <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={fornecedorId} onValueChange={setFornecedorId}>
                    <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                      <SelectValue placeholder="Selecione o fornecedor..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <div className="p-1 border-b border-slate-100">
                        <Input
                          placeholder="Buscar fornecedor..."
                          value={buscaFornecedorModal}
                          onChange={(e) => setBuscaFornecedorModal(e.target.value)}
                          className="h-7 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {fornecedoresFiltradosModal.length === 0 ? (
                        <div className="p-2 text-xs text-slate-400 text-center">
                          Nenhum fornecedor ativo encontrado
                        </div>
                      ) : (
                        fornecedoresFiltradosModal.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">
                            {f.nome} {f.documento ? `(${f.documento})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data da Compra */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Data da Compra</Label>
                  <Input
                    type="date"
                    value={dataCompra}
                    onChange={(e) => setDataCompra(e.target.value)}
                    className="text-xs h-9 bg-white border-slate-200"
                    required
                  />
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento</Label>
                  <Select
                    value={formaPagamento}
                    onValueChange={(val: 'a_prazo' | 'pago') => setFormaPagamento(val)}
                  >
                    <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_prazo" className="text-xs">
                        A Prazo (Conta a Pagar)
                      </SelectItem>
                      <SelectItem value="pago" className="text-xs">
                        À Vista (Pago)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Vencimento ou Valor Pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {formaPagamento === 'a_prazo' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Data de Vencimento da Conta a Pagar
                    </Label>
                    <Input
                      type="date"
                      value={vencimento}
                      onChange={(e) => setVencimento(e.target.value)}
                      className="text-xs h-9 bg-white border-slate-200"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Valor Pago (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorPago}
                      onChange={(e) => setValorPago(e.target.value)}
                      placeholder="0,00"
                      className="text-xs h-9 bg-white border-slate-200 font-mono"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Observações (opcional)
                  </Label>
                  <Input
                    type="text"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: Pedido nº 1234, NF, frete..."
                    className="text-xs h-9 bg-white border-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Step 2 — Itens da Compra */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  2. Itens da Compra ({itensForm.length})
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={adicionarLinhaItem}
                  className="h-8 text-xs text-teal-700 border-teal-300 hover:bg-teal-50 flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Produto
                </Button>
              </div>

              {itensForm.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-xs text-slate-400 space-y-2">
                  <Package className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Nenhum produto adicionado ainda.</p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={adicionarLinhaItem}
                    className="h-7 text-xs bg-teal-700 hover:bg-teal-800 text-white"
                  >
                    + Adicionar Primeiro Produto
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {itensForm.map((item, idx) => (
                    <div
                      key={`item-linha-${idx}`}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                    >
                      {/* Produto Select */}
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-[11px] text-slate-500">Produto #{idx + 1}</Label>
                        <Select
                          value={item.produto_id}
                          onValueChange={(val) => handleSelectProdutoItem(idx, val)}
                        >
                          <SelectTrigger className="text-xs h-9 bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Selecione um produto..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {produtos.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                <span className="font-semibold">{p.nome}</span>
                                {p.codigo && ` (${p.codigo})`} — Saldo:{' '}
                                {p.estoques?.[0]?.quantidade ?? 0} {p.unidade} (Custo:{' '}
                                {formatCurrency(p.preco_custo)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantidade */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] text-slate-500">
                          Qtd ({item.unidade || 'UN'})
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantidade}
                          onChange={(e) => handleUpdateItemQuantidade(idx, e.target.value)}
                          className="text-xs h-9 font-mono"
                          required
                        />
                      </div>

                      {/* Preço Unitário */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] text-slate-500">Preço Unit. (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_unitario}
                          onChange={(e) => handleUpdateItemPreco(idx, e.target.value)}
                          className="text-xs h-9 font-mono"
                          required
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="sm:col-span-2 space-y-1 text-right">
                        <Label className="text-[11px] text-slate-500">Subtotal</Label>
                        <div className="h-9 flex items-center justify-end font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.subtotal)}
                        </div>
                      </div>

                      {/* Remover */}
                      <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => removerLinhaItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          title="Remover Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé: Total & Botões */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-slate-500">Total da Compra:</span>
                <span className="text-2xl font-black text-teal-700 tabular-nums">
                  {formatCurrency(totalNovaCompra)}
                </span>
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submittingNova}
                  onClick={() => setModalNovaAberta(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingNova || itensForm.length === 0}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-2"
                >
                  {submittingNova ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Rascunho'
                  )}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          DIALOG 2: EDITAR COMPRA (Rascunho)
          ========================================================================= */}
      <Dialog open={modalEditarAberta} onOpenChange={setModalEditarAberta}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Edit className="w-5 h-5 text-teal-700" />
              Editar Compra #{editNumeroCompra}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modifique os dados ou itens da compra antes da confirmação de entrada.
            </DialogDescription>
          </DialogHeader>

          {loadingEditarData ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Carregando dados da compra...
            </div>
          ) : (
            <form onSubmit={handleSubmitSalvarEdicao} className="space-y-6 pt-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  1. Dados Gerais
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">Fornecedor</Label>
                    <Select value={editFornecedorId} onValueChange={setEditFornecedorId}>
                      <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">
                            {f.nome} {f.documento ? `(${f.documento})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Data da Compra</Label>
                    <Input
                      type="date"
                      value={editDataCompra}
                      onChange={(e) => setEditDataCompra(e.target.value)}
                      className="text-xs h-9 bg-white border-slate-200"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Forma de Pagto</Label>
                    <Select
                      value={editFormaPagamento}
                      onValueChange={(val: 'a_prazo' | 'pago') => setEditFormaPagamento(val)}
                    >
                      <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a_prazo" className="text-xs">
                          A Prazo
                        </SelectItem>
                        <SelectItem value="pago" className="text-xs">
                          À Vista (Pago)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {editFormaPagamento === 'a_prazo' ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Vencimento</Label>
                      <Input
                        type="date"
                        value={editVencimento}
                        onChange={(e) => setEditVencimento(e.target.value)}
                        className="text-xs h-9 bg-white border-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">
                        Valor Pago (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValorPago}
                        onChange={(e) => setEditValorPago(e.target.value)}
                        className="text-xs h-9 bg-white border-slate-200 font-mono"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Observações</Label>
                    <Input
                      type="text"
                      value={editObservacoes}
                      onChange={(e) => setEditObservacoes(e.target.value)}
                      className="text-xs h-9 bg-white border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    2. Itens ({editItensForm.length})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={adicionarEditLinhaItem}
                    className="h-8 text-xs text-teal-700 border-teal-300 hover:bg-teal-50 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Produto
                  </Button>
                </div>

                <div className="space-y-2">
                  {editItensForm.map((item, idx) => (
                    <div
                      key={`edit-item-${idx}`}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                    >
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-[11px] text-slate-500">Produto #{idx + 1}</Label>
                        <Select
                          value={item.produto_id}
                          onValueChange={(val) => handleSelectProdutoEditItem(idx, val)}
                        >
                          <SelectTrigger className="text-xs h-9 bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Selecione um produto..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {produtos.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                <span className="font-semibold">{p.nome}</span>
                                {p.codigo && ` (${p.codigo})`} — Saldo:{' '}
                                {p.estoques?.[0]?.quantidade ?? 0} {p.unidade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] text-slate-500">
                          Qtd ({item.unidade || 'UN'})
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantidade}
                          onChange={(e) => handleUpdateEditItemQuantidade(idx, e.target.value)}
                          className="text-xs h-9 font-mono"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] text-slate-500">Preço Unit. (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_unitario}
                          onChange={(e) => handleUpdateEditItemPreco(idx, e.target.value)}
                          className="text-xs h-9 font-mono"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1 text-right">
                        <Label className="text-[11px] text-slate-500">Subtotal</Label>
                        <div className="h-9 flex items-center justify-end font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.subtotal)}
                        </div>
                      </div>

                      <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => removerEditLinhaItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rodapé */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-slate-500">Total da Compra:</span>
                  <span className="text-2xl font-black text-teal-700 tabular-nums">
                    {formatCurrency(totalEditCompra)}
                  </span>
                </div>

                <DialogFooter className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submittingEditar}
                    onClick={() => setModalEditarAberta(false)}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingEditar || editItensForm.length === 0}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-2"
                  >
                    {submittingEditar ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          DIALOG 3: CONFIRMAR COMPRA
          ========================================================================= */}
      <Dialog
        open={modalConfirmarAberta}
        onOpenChange={(open) => {
          if (!submittingConfirmar) setModalConfirmarAberta(open)
        }}
      >
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <div className="flex items-center gap-2 text-teal-800">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Confirmar Compra #{compraParaConfirmar?.numero}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 pt-1">
              Revise o resumo antes de oficializar a entrada no estoque.
            </DialogDescription>
          </DialogHeader>

          {compraParaConfirmar && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Fornecedor:</span>
                  <span className="font-semibold text-slate-900">
                    {compraParaConfirmar.fornecedores?.nome || 'Fornecedor'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Itens na Compra:</span>
                  <span className="font-medium text-slate-900">
                    {compraParaConfirmar.itens_compra?.length ?? 'Itens inclusos'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Forma de Pagamento:</span>
                  <span className="font-medium text-slate-900">
                    {compraParaConfirmar.forma_pagamento === 'pago' ? 'À Vista / Pago' : 'A Prazo'}
                  </span>
                </div>
                {compraParaConfirmar.forma_pagamento === 'a_prazo' && (
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Vencimento da Conta:</span>
                    <span className="font-medium text-slate-900">
                      {formatDate(compraParaConfirmar.vencimento)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-200 font-bold">
                  <span>Total a Pagar:</span>
                  <span className="text-teal-700 font-black text-sm">
                    {formatCurrency(compraParaConfirmar.total || 0)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Após confirmar, o estoque será atualizado, as movimentações serão registradas e
                  uma conta a pagar poderá ser criada automaticamente.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={submittingConfirmar}
              onClick={() => setModalConfirmarAberta(false)}
              className="text-xs"
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={submittingConfirmar}
              onClick={handleExecutarConfirmacao}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs"
            >
              {submittingConfirmar ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar Compra'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          DIALOG 4: DETALHES DA COMPRA
          ========================================================================= */}
      <Dialog open={modalDetalhesAberta} onOpenChange={setModalDetalhesAberta}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-700" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Compra #{compraDetalhe?.numero}
                </DialogTitle>
              </div>
              {compraDetalhe?.status && getStatusBadge(compraDetalhe.status)}
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Registrada em {formatDate(compraDetalhe?.data_compra || compraDetalhe?.created_at)}
            </DialogDescription>
          </DialogHeader>

          {loadingDetalhes ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Carregando detalhes da compra...
            </div>
          ) : compraDetalhe ? (
            <div className="space-y-4 text-xs">
              {/* Fornecedor & Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                    Fornecedor
                  </span>
                  <p className="font-bold text-slate-900 text-sm">
                    {compraDetalhe.fornecedores?.nome || 'Fornecedor'}
                  </p>
                  {compraDetalhe.fornecedores?.documento && (
                    <p className="text-slate-600">Doc: {compraDetalhe.fornecedores.documento}</p>
                  )}
                  {compraDetalhe.fornecedores?.telefone && (
                    <p className="text-slate-600">Tel: {compraDetalhe.fornecedores.telefone}</p>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                    Condições de Pagamento
                  </span>
                  <p className="font-bold text-slate-900 text-sm">
                    {compraDetalhe.forma_pagamento === 'pago' ? 'À Vista (Pago)' : 'A Prazo'}
                  </p>
                  {compraDetalhe.vencimento && (
                    <p className="text-slate-600">
                      Vencimento: {formatDate(compraDetalhe.vencimento)}
                    </p>
                  )}
                  {compraDetalhe.valor_pago > 0 && (
                    <p className="text-emerald-700 font-semibold">
                      Valor Pago: {formatCurrency(compraDetalhe.valor_pago)}
                    </p>
                  )}
                </div>
              </div>

              {/* Tabela de Itens */}
              <div className="space-y-2">
                <span className="font-bold text-slate-900 block">Itens da Compra</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Produto</th>
                        <th className="py-2.5 px-3 text-center">Qtd</th>
                        <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!compraDetalhe.itens_compra || compraDetalhe.itens_compra.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                            Nenhum item registrado para esta compra.
                          </td>
                        </tr>
                      ) : (
                        compraDetalhe.itens_compra.map((item: any) => (
                          <tr key={item.id}>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-slate-900">
                                {item.produtos?.nome || 'Produto'}
                              </p>
                              {item.produtos?.codigo && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  #{item.produtos.codigo}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold">
                              {item.quantidade} {item.produtos?.unidade || 'UN'}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              {formatCurrency(item.preco_unitario)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                              {formatCurrency(item.subtotal)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end pt-1">
                <div className="w-64 p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-slate-900 font-bold">
                  <span>Total da Compra:</span>
                  <span className="text-teal-700 font-black text-base">
                    {formatCurrency(compraDetalhe.total || 0)}
                  </span>
                </div>
              </div>

              {/* Conta a Pagar Gerada */}
              {contaPagarDetalhe && (
                <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-teal-700" />
                      Conta a Pagar Vinculada
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-white border-teal-300 text-teal-800 text-[10px]"
                    >
                      {contaPagarDetalhe.status?.toUpperCase() || 'PENDENTE'}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Vencimento: {formatDate(contaPagarDetalhe.vencimento)}</span>
                    <span className="font-bold text-teal-800">
                      {formatCurrency(contaPagarDetalhe.valor)}
                    </span>
                  </div>
                </div>
              )}

              {/* Observações */}
              {compraDetalhe.observacoes && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">Observações:</span>
                  <p className="text-slate-600 whitespace-pre-wrap">{compraDetalhe.observacoes}</p>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrintCompraAberto(true)}
              className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-teal-700" />
              Imprimir Compra
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalDetalhesAberta(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          DIALOG 5: CANCELAR COMPRA (Rascunho)
          ========================================================================= */}
      <Dialog
        open={modalCancelarAberta}
        onOpenChange={(open) => {
          if (!submittingCancelar) setModalCancelarAberta(open)
        }}
      >
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-700">
              <XCircle className="w-5 h-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Cancelar Compra #{compraParaCancelar?.numero}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 pt-1 leading-relaxed">
              Deseja realmente cancelar este rascunho de compra? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={submittingCancelar}
              onClick={() => setModalCancelarAberta(false)}
              className="text-xs"
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={submittingCancelar}
              onClick={handleExecutarCancelamento}
              className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold"
            >
              {submittingCancelar ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL DE IMPRESSÃO DA COMPRA
          ========================================================================= */}
      {compraDetalhe && (
        <PrintPreviewDialog
          open={printCompraAberto}
          onOpenChange={setPrintCompraAberto}
          title={`Impressão - Compra #${compraDetalhe.numero}`}
        >
          <CompraPrintDocument
            empresa={{
              nome: empresa?.nome || 'EVO Gestão Comercial',
              nome_fantasia: empresa?.nome_fantasia,
              cnpj: empresa?.cnpj,
              telefone: empresa?.telefone,
              email: empresa?.email,
              logo_url: empresa?.logo_url,
            }}
            compra={compraDetalhe}
          />
        </PrintPreviewDialog>
      )}
    </div>
  )
}
