import { useState, useEffect } from 'react'
import { PageHeader, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { ConfiguracoesService } from '@/services/configuracoes'
import { Building2, Shield, Users, CreditCard, CheckCircle2 } from 'lucide-react'

export default function ConfiguracoesPage() {
  const { empresaId, empresa } = useEmpresa()
  const { usuario } = useAuth()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [assinatura, setAssinatura] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadConfigData() {
      if (!empresaId) return
      setLoading(true)
      setError(null)
      try {
        const [usrRes, assRes] = await Promise.all([
          ConfiguracoesService.listUsuariosEmpresa(empresaId),
          ConfiguracoesService.getAssinaturaComPlano(empresaId),
        ])
        if (usrRes.error) throw usrRes.error
        setUsuarios(usrRes.data || [])
        setAssinatura(assRes.data || null)
      } catch (e: any) {
        setError(e.message || 'Falha ao carregar configurações')
      } finally {
        setLoading(false)
      }
    }

    loadConfigData()
  }, [empresaId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações do Sistema"
        description="Dados da distribuidora, usuários autorizados e plano de assinatura."
      />

      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Dados da Empresa */}
          <Card className="border border-slate-200 bg-white shadow-xs md:col-span-2">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-teal-700">
                <Building2 className="w-5 h-5" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Dados da Distribuidora
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Informações cadastrais associadas à sua conta EVO
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Razão Social</span>
                  <p className="font-semibold text-slate-900 text-sm">{empresa?.nome || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Nome Fantasia</span>
                  <p className="font-semibold text-slate-900 text-sm">
                    {empresa?.nome_fantasia || empresa?.nome || '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">CNPJ</span>
                  <p className="font-mono text-slate-800 text-sm">{empresa?.cnpj || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Email de Contato</span>
                  <p className="text-slate-800 text-sm">{empresa?.email || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Telefone</span>
                  <p className="text-slate-800 text-sm">{empresa?.telefone || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Status da Conta</span>
                  <p>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      {empresa?.status || 'Ativa'}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plano / Assinatura */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-teal-700">
                <CreditCard className="w-5 h-5" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Plano e Assinatura
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Licenciamento e limites
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  Plano Contratado
                </span>
                <h4 className="text-lg font-bold text-teal-950 mt-0.5">
                  {assinatura?.planos?.nome || 'EVO Distribuição Pro'}
                </h4>
                <p className="text-xs text-teal-700 mt-1">
                  Limite de Usuários: {assinatura?.planos?.limite_usuarios || 'Ilimitado'}
                </p>
              </div>

              <div className="text-xs space-y-2 pt-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Status Assinatura:</span>
                  <span className="font-semibold text-emerald-700 capitalize">
                    {assinatura?.status || 'Ativa'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Vigência Início:</span>
                  <span className="text-slate-700 font-mono">
                    {assinatura?.inicio
                      ? new Date(assinatura.inicio).toLocaleDateString('pt-BR')
                      : 'Ativo'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Usuários */}
          <Card className="border border-slate-200 bg-white shadow-xs md:col-span-3">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-teal-700">
                  <Users className="w-5 h-5" />
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Usuários com Acesso à Empresa
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Membros da equipe vinculados a este ambiente
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-slate-600 border-slate-200">
                  {usuarios.length} Usuários
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Perfil</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuarios.map((usr) => (
                      <tr key={usr.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-semibold text-slate-900">{usr.nome}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{usr.email}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-teal-800 uppercase text-[11px] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {usr.perfil}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={
                              usr.ativo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }
                          >
                            {usr.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
