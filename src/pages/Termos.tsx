import { Link } from 'react-router-dom'
import { Building2, ArrowLeft, ShieldAlert, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#0E1B2C] text-slate-100 flex flex-col justify-between">
      {/* Header bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/auth" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-md shadow-teal-950/60 border border-teal-400/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-lg tracking-tight group-hover:text-teal-400 transition-colors">
                EVO Gestão
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-400 font-medium">
                Termos de Uso
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/privacidade">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
              >
                Política de Privacidade
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                variant="outline"
                size="sm"
                className="border-teal-500/40 text-teal-300 hover:bg-teal-950/50 hover:text-white text-xs gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        {/* Banner de Aviso Modelo Base */}
        <div className="mb-8 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 sm:p-5 text-amber-200 flex items-start gap-3 shadow-lg">
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wide">
              Aviso Importante — Modelo Base Pré-Configurado
            </h2>
            <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
              Este documento é um <strong>modelo base orientativo</strong> disponibilizado para o
              software EVO Gestão. Antes de iniciar o uso comercial e operações regulares com
              clientes e fornecedores, o responsável legal da empresa licenciada deve revisar e
              adequar este conteúdo às suas particularidades jurídicas, fiscais e operacionais.
            </p>
          </div>
        </div>

        {/* Artigo / Documento */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 sm:p-10 shadow-2xl space-y-8 text-slate-300 text-sm leading-relaxed">
          <header className="border-b border-slate-800 pb-6">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <FileText className="w-4 h-4" />
              Contrato de Licenciamento e Termos de Uso
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Termos de Uso — EVO Gestão
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Última atualização: {new Date().toLocaleDateString('pt-BR')} | Versão 1.0 (Produção)
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              1. Apresentação e Objeto do Software
            </h2>
            <p>
              O <strong>EVO Gestão</strong> é uma plataforma SaaS (Software como Serviço) voltada à
              gestão comercial, operacional e financeira de empresas distribuidoras, atacadistas e
              comércios em geral. O sistema provê funcionalidades como controle de estoque, emissão
              de pedidos de venda, controle de compras, faturamento, gestão de comissões de
              vendedores, contas a pagar e receber, além de relatórios gerenciais e de
              lucratividade.
            </p>
            <p>
              Ao criar uma conta, acessar ou utilizar a plataforma por meio de navegadores web ou
              dispositivos móveis, a empresa usuária (“Licenciada”) e seus usuários vinculados
              concordam integralmente com estes Termos de Uso.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              2. Cadastro, Acesso e Responsabilidade pelas Credenciais
            </h2>
            <p>
              O acesso ao sistema é concedido mediante autenticação individual com e-mail e senha. A
              Licenciada é a única responsável pela guarda, sigilo e uso adequado das credenciais de
              acesso concedidas aos seus colaboradores, sócios e prepostos.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>Cada usuário deve possuir credenciais próprias e intransferíveis;</li>
              <li>
                A Licenciada deve revogar prontamente o acesso de qualquer colaborador desligado ou
                cujo perfil deva ser alterado;
              </li>
              <li>
                Toda operação registrada sob as credenciais de um usuário cadastrado será presumida
                como autorizada pela Licenciada.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              3. Isolamento Multiempresa e Segurança dos Dados
            </h2>
            <p>
              O EVO Gestão adota arquitetura de segurança multiempresa rigorosa. As informações
              cadastradas por cada organização são logicamente isoladas no banco de dados por meio
              de chaves de identificação institucional (
              <code className="text-teal-400 text-xs bg-slate-800 px-1.5 py-0.5 rounded">
                empresa_id
              </code>
              ) e políticas de segurança a nível de linha (Row Level Security - RLS).
            </p>
            <p>
              Nenhum dado comercial, financeiro, de clientes ou fornecedores de uma empresa pode ser
              visualizado, alterado ou exportado por outra empresa usuária da plataforma.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              4. Propriedade Intelectual e Licença de Uso
            </h2>
            <p>
              A contratação do sistema concede à Licenciada uma licença de uso revogável, não
              exclusiva e intransferível do software. A estrutura do código-fonte, marcas,
              interfaces, algoritmos de cálculo e documentação são de propriedade exclusiva do
              desenvolvedor ou da empresa controladora do EVO Gestão.
            </p>
            <p>
              É expressamente vedada a engenharia reversa, descompilação, cópia de componentes de
              software ou comercialização de sublicenças sem prévia e expressa autorização por
              escrito.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              5. Planos, Assinaturas e Disponibilidade
            </h2>
            <p>
              A utilização do sistema está condicionada à vigência de um plano de assinatura
              contratado ou período de avaliação (trial) autorizado. Caso a assinatura seja
              cancelada ou expire sem quitação, as funções de escrita e faturamento poderão ser
              suspensas até a devida regularização financeira, assegurado o direito da Licenciada de
              solicitar a exportação ou cópia de segurança de seus dados cadastrais conforme a
              legislação vigente.
            </p>
            <p>
              Envidados os melhores esforços técnicos para garantir 99% de disponibilidade (uptime),
              paradas programadas para manutenção, atualização de segurança e aprimoramento de
              infraestrutura serão comunicadas previamente sempre que factível.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              6. Limitação de Responsabilidade
            </h2>
            <p>
              O EVO Gestão atua como ferramenta de apoio operacional e gerencial. As informações
              fiscais, valores de produtos, regras de precificação, estoques físicos reais e
              obrigações tributárias são de estrita responsabilidade da Licenciada e de sua
              respectiva assessoria contábil. O software não substitui a validação de um
              profissional de contabilidade habilitado.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">7. Contato e Foro</h2>
            <p>
              Para esclarecimentos sobre estes Termos de Uso, suporte técnico ou informações de
              contratação, o canal oficial de atendimento é:
            </p>
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs sm:text-sm text-slate-300 space-y-1">
              <p>
                <strong>Controlador / Suporte da Plataforma:</strong> EVO Gestão Tecnologia e
                Software
              </p>
              <p>
                <strong>E-mail de Contato:</strong> suporte@evogestao.com.br (ou canal configurado
                pelo administrador)
              </p>
              <p>
                <strong>Legislação Aplicável:</strong> Leis da República Federativa do Brasil,
                incluindo o Marco Civil da Internet e a LGPD.
              </p>
            </div>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            EVO Gestão © {new Date().getFullYear()} — Plataforma Multiempresa para Gestão Comercial
          </p>
          <div className="flex items-center gap-4">
            <Link to="/termos" className="text-slate-400 hover:text-white transition-colors">
              Termos de Uso
            </Link>
            <span>•</span>
            <Link to="/privacidade" className="text-slate-400 hover:text-white transition-colors">
              Política de Privacidade (LGPD)
            </Link>
            <span>•</span>
            <Link to="/auth" className="text-teal-400 hover:text-teal-300 transition-colors">
              Acesso ao Sistema
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
