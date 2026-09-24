import { Link } from 'react-router-dom'
import { Building2, ArrowLeft, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PrivacidadePage() {
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
                Privacidade & LGPD
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/termos">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
              >
                Termos de Uso
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
              Aviso Importante — Modelo Base Pré-Configurado (LGPD)
            </h2>
            <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
              Esta Política de Privacidade é um <strong>modelo base orientativo</strong> estruturado
              com base nas diretrizes da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
              Antes da disponibilização comercial ao público, o responsável da empresa deve
              preencher os dados de contato do Encarregado de Dados (DPO) e verificar eventuais
              fluxos específicos da sua operação.
            </p>
          </div>
        </div>

        {/* Artigo / Documento */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 sm:p-10 shadow-2xl space-y-8 text-slate-300 text-sm leading-relaxed">
          <header className="border-b border-slate-800 pb-6">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Lock className="w-4 h-4" />
              Proteção de Dados Pessoais & Conformidade LGPD
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Política de Privacidade e Proteção de Dados
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Em consonância com a Lei Federal nº 13.709/2018 (LGPD) | Última atualização:{' '}
              {new Date().toLocaleDateString('pt-BR')}
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              1. Compromisso com a Privacidade
            </h2>
            <p>
              O <strong>EVO Gestão</strong> valoriza a segurança, a transparência e a privacidade
              dos dados de seus clientes, usuários e parceiros. Esta Política de Privacidade
              descreve como os dados são coletados, utilizados, protegidos e processados no âmbito
              da plataforma de gestão comercial.
            </p>
            <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-500/30 text-teal-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>
                <strong>Princípio Fundamental:</strong> O EVO Gestão NUNCA comercializa, aluga ou
                compartilha dados cadastrais ou operacionais para fins publicitários de terceiros.
              </span>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              2. Categorias de Dados Tratados
            </h2>
            <p>
              Para a execução dos serviços de gestão comercial e operacional contratados pela
              empresa usuária, o sistema armazena:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                <span className="font-semibold text-white block">Dados da Empresa Licenciada</span>
                <p className="text-slate-400">
                  Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, endereço, telefone e
                  logomarca institucional.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                <span className="font-semibold text-white block">
                  Dados de Usuários e Vendedores
                </span>
                <p className="text-slate-400">
                  Nome completo, e-mail de acesso corporativo, senha criptografada, telefone, cargo
                  e comissões associadas.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                <span className="font-semibold text-white block">
                  Dados de Clientes e Fornecedores
                </span>
                <p className="text-slate-400">
                  Nome/Razão Social, CPF/CNPJ, e-mail, telefone comercial, endereço de entrega e
                  histórico de pedidos/compras.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                <span className="font-semibold text-white block">
                  Dados Financeiros e Operacionais
                </span>
                <p className="text-slate-400">
                  Contas a pagar/receber, registros de vendas, compras, movimentações de estoque e
                  fluxo de caixa.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              3. Finalidade do Tratamento de Dados
            </h2>
            <p>
              Os dados tratados pela plataforma destinam-se exclusivamente às seguintes finalidades
              legítimas:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                <strong>Execução de Contrato:</strong> Viabilizar emissão de pedidos, cálculo de
                totais, conciliação de faturamento, baixa de recebíveis e relatórios gerenciais;
              </li>
              <li>
                <strong>Autenticação e Auditoria:</strong> Garantir que apenas usuários autorizados
                acessem os dados restritos de cada organização;
              </li>
              <li>
                <strong>Cumprimento de Obrigações Legais:</strong> Manutenção de histórico
                operacional e contábil conforme exigências fiscais e regulatórias vigentes no
                Brasil;
              </li>
              <li>
                <strong>Comunicação Transacional:</strong> Envio de avisos de recuperação de senha,
                confirmações de cadastro e alertas operacionais do sistema.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              4. Segurança da Informação e Isolamento Multiempresa
            </h2>
            <p>
              O EVO Gestão implementa práticas modernas de cibersegurança e proteção de
              infraestrutura, incluindo:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                <strong>Isolamento Lógico em Camada de Banco (RLS):</strong> Mecanismos nativos de{' '}
                <em>Row Level Security</em> impedem que dados de uma empresa sejam acessados por
                outra;
              </li>
              <li>
                <strong>Criptografia em Trânsito e Repouso:</strong> Todas as comunicações utilizam
                protocolos criptográficos HTTPS/TLS seguros;
              </li>
              <li>
                <strong>Criptografia Forte de Credenciais:</strong> Senhas são armazenadas
                utilizando algoritmos de derivação de chave de padrão bancário (bcrypt/argon2), sem
                armazenamento em texto plano;
              </li>
              <li>
                <strong>Controle Granular de Perfis:</strong> Acesso baseado em cargos e papéis
                institucionais definidos pelo gestor da empresa.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              5. Compartilhamento de Dados
            </h2>
            <p>
              Não compartilhamos dados com terceiros para fins comerciais. O compartilhamento
              restringe-se estritamente aos fornecedores de infraestrutura tecnológica essenciais
              para o funcionamento da aplicação:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                <strong>Provedor de Nuvem e Banco de Dados:</strong> Serviços de computação e banco
                de dados relacional seguro (ex: Supabase / PostgreSQL em nuvem criptografada);
              </li>
              <li>
                <strong>Gateways de Pagamento:</strong> Processamento seguro de assinaturas quando
                acionado pelo cliente (ex: Mercado Pago);
              </li>
              <li>
                <strong>Autoridades Competentes:</strong> Mediante ordem judicial fundamentada ou
                obrigação legal expressa.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              6. Direitos dos Titulares de Dados (LGPD — Art. 18)
            </h2>
            <p>
              Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), os titulares de dados
              pessoais têm garantidos os direitos de:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                ✓ Confirmação da existência de tratamento
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                ✓ Acesso aos dados pessoais cadastrados
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                ✓ Correção de dados incompletos, inexatos ou desatualizados
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                ✓ Eliminação de dados pessoais tratados com consentimento
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                ✓ Informação das entidades públicas e privadas com as quais houve uso compartilhado
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                ✓ Revogação do consentimento nos termos da lei
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              <em>Observação:</em> Dados contidos em vendas, notas ou títulos financeiros sujeitos a
              obrigações tributárias e fiscais são mantidos pelo prazo legal mínimo estipulado pela
              legislação tributária brasileira antes de eventual exclusão definitiva.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white">
              7. Canal do Encarregado de Dados (DPO) e Contato
            </h2>
            <p>
              Para exercer seus direitos de titular, tirar dúvidas sobre o tratamento de seus dados
              ou solicitar esclarecimentos adicionais, entre em contato com nosso Encarregado pelo
              Tratamento de Dados Pessoais:
            </p>
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs sm:text-sm text-slate-300 space-y-1">
              <p>
                <strong>Encarregado de Dados (DPO):</strong> Setor de Privacidade e Segurança da
                Informação
              </p>
              <p>
                <strong>E-mail para solicitações LGPD:</strong> dpo@evogestao.com.br (ou contato
                oficial do administrador)
              </p>
              <p>
                <strong>Prazo de Resposta:</strong> Conforme prazos legais regulamentados pela ANPD
                (Autoridade Nacional de Proteção de Dados).
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
