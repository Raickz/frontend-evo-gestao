import React from 'react'

export interface EmpresaInfo {
  nome: string
  nome_fantasia?: string | null
  cnpj?: string | null
  telefone?: string | null
  email?: string | null
  logo_url?: string | null
}

interface PrintCompanyHeaderProps {
  empresa: EmpresaInfo
  documentTitle: string
  documentSubtitle?: string
  numero?: string | number | null
  dataEmissao?: string | Date | null
  statusBadge?: React.ReactNode
}

export const PrintCompanyHeader: React.FC<PrintCompanyHeaderProps> = ({
  empresa,
  documentTitle,
  documentSubtitle,
  numero,
  dataEmissao,
  statusBadge,
}) => {
  const nomePrincipal = empresa.nome_fantasia?.trim() || empresa.nome
  const razaoSocial = empresa.nome_fantasia?.trim() ? empresa.nome : null

  const dataFormatada = dataEmissao
    ? new Date(dataEmissao).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

  return (
    <header className="border-b-2 border-slate-800 pb-5 mb-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        {/* Lado Esquerdo: Identificação da Empresa */}
        <div className="flex items-start gap-4">
          {empresa.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={nomePrincipal}
              className="w-16 h-16 object-contain rounded border border-slate-200 p-1"
            />
          ) : (
            <div className="w-14 h-14 bg-teal-800 text-white font-bold text-xl flex items-center justify-center rounded uppercase tracking-wider print:border print:border-black print:bg-slate-100 print:text-black">
              {nomePrincipal.slice(0, 2)}
            </div>
          )}

          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight uppercase print:text-black">
              {nomePrincipal}
            </h1>
            {razaoSocial && (
              <p className="text-xs text-slate-600 font-medium print:text-slate-700">
                Razão Social: {razaoSocial}
              </p>
            )}
            <div className="mt-1 text-xs text-slate-600 space-y-0.5 print:text-slate-700">
              {empresa.cnpj && (
                <p>
                  <span className="font-semibold text-slate-700 print:text-black">CNPJ:</span>{' '}
                  {empresa.cnpj}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3">
                {empresa.telefone && (
                  <span>
                    <span className="font-semibold text-slate-700 print:text-black">Tel:</span>{' '}
                    {empresa.telefone}
                  </span>
                )}
                {empresa.email && (
                  <span>
                    <span className="font-semibold text-slate-700 print:text-black">E-mail:</span>{' '}
                    {empresa.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Identificação do Documento */}
        <div className="text-left sm:text-right flex-shrink-0 min-w-[200px]">
          <div className="inline-block sm:text-right">
            <h2 className="text-base font-extrabold tracking-wide text-slate-900 uppercase border-b border-slate-300 pb-1 mb-1 print:text-black">
              {documentTitle}
            </h2>
            {documentSubtitle && (
              <p className="text-xs text-slate-600 font-medium print:text-slate-700">
                {documentSubtitle}
              </p>
            )}
            {numero !== undefined && numero !== null && (
              <p className="text-lg font-black text-slate-800 tracking-tight mt-1 print:text-black">
                Nº {String(numero).padStart(6, '0')}
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-1 print:text-slate-600">
              <span className="font-medium">Emissão:</span> {dataFormatada}
            </p>
            {statusBadge && <div className="mt-2 flex sm:justify-end">{statusBadge}</div>}
          </div>
        </div>
      </div>
    </header>
  )
}
