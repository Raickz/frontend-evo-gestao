export type UserRole = 'master' | 'admin' | 'gerente' | 'vendedor' | 'operador'

export type AppPage =
  | 'dashboard'
  | 'relatorios'
  | 'clientes'
  | 'produtos'
  | 'fornecedores'
  | 'compras'
  | 'estoque'
  | 'vendas'
  | 'pedidos'
  | 'financeiro'
  | 'vendedores'
  | 'comissoes'
  | 'configuracoes'

/**
 * Mapeamento estrito de quais páginas cada papel pode acessar.
 * Regras:
 * MASTER: Acesso irrestrito a todas as páginas
 * ADMIN: Dashboard, Clientes, Produtos, Fornecedores, Compras, Estoque, Vendas, Pedidos, Financeiro, Vendedores, Comissões, Configurações
 * GERENTE: Dashboard, Clientes, Produtos, Fornecedores, Compras, Estoque, Vendas, Pedidos, Financeiro, Vendedores, Comissões
 * VENDEDOR: Dashboard, Clientes, Produtos, Vendas, Pedidos, Comissões
 * OPERADOR: Dashboard, Clientes, Fornecedores, Produtos, Compras, Estoque, Vendas, Pedidos
 */
export const ROLE_PAGES: Record<UserRole, readonly AppPage[]> = {
  master: [
    'dashboard',
    'relatorios',
    'clientes',
    'produtos',
    'fornecedores',
    'compras',
    'estoque',
    'vendas',
    'pedidos',
    'financeiro',
    'vendedores',
    'comissoes',
    'configuracoes',
  ],
  admin: [
    'dashboard',
    'relatorios',
    'clientes',
    'produtos',
    'fornecedores',
    'compras',
    'estoque',
    'vendas',
    'pedidos',
    'financeiro',
    'vendedores',
    'comissoes',
    'configuracoes',
  ],
  gerente: [
    'dashboard',
    'relatorios',
    'clientes',
    'produtos',
    'fornecedores',
    'compras',
    'estoque',
    'vendas',
    'pedidos',
    'financeiro',
    'vendedores',
    'comissoes',
  ],
  operador: [
    'dashboard',
    'relatorios',
    'clientes',
    'fornecedores',
    'produtos',
    'compras',
    'estoque',
    'vendas',
    'pedidos',
  ],
  vendedor: ['dashboard', 'clientes', 'produtos', 'vendas', 'pedidos', 'comissoes'],
}

/**
 * Mapeamento de rotas/caminhos para identificador de página AppPage.
 */
export const PATH_TO_PAGE_MAP: Record<string, AppPage> = {
  '/app': 'dashboard',
  '/app/dashboard': 'dashboard',
  '/app/relatorios': 'relatorios',
  '/app/clientes': 'clientes',
  '/app/produtos': 'produtos',
  '/app/fornecedores': 'fornecedores',
  '/app/compras': 'compras',
  '/app/estoque': 'estoque',
  '/app/vendas': 'vendas',
  '/app/pedidos': 'pedidos',
  '/app/financeiro': 'financeiro',
  '/app/vendedores': 'vendedores',
  '/app/comissoes': 'comissoes',
  '/app/configuracoes': 'configuracoes',
}

/**
 * Normaliza uma string de perfil para o tipo UserRole suportado.
 */
export function normalizeRole(perfil: string | null | undefined): UserRole | null {
  if (!perfil) return null
  const normalized = perfil.toLowerCase().trim()
  if (['master', 'admin', 'gerente', 'vendedor', 'operador'].includes(normalized)) {
    return normalized as UserRole
  }
  return null
}

/**
 * Verifica se um determinado perfil possui permissão para acessar uma página.
 */
export function canAccessPage(perfil: string | null | undefined, page: AppPage | string): boolean {
  const role = normalizeRole(perfil)
  if (!role) return false
  if (role === 'master') return true

  const targetPage: AppPage | undefined =
    (PATH_TO_PAGE_MAP[page] as AppPage) ||
    (Object.values(PATH_TO_PAGE_MAP).includes(page as AppPage) ? (page as AppPage) : undefined)

  if (!targetPage) return false

  const allowedPages = ROLE_PAGES[role] || []
  return allowedPages.includes(targetPage)
}

/**
 * Retorna as páginas permitidas para o perfil.
 */
export function getAllowedPages(perfil?: string | null): readonly AppPage[] {
  const role = normalizeRole(perfil)
  if (!role) return []
  return ROLE_PAGES[role] || []
}

/**
 * Retorna label e cor para exibição do perfil do usuário.
 */
export function formatPerfilBadge(perfil?: string | null): { label: string; color: string } {
  const role = normalizeRole(perfil)
  switch (role) {
    case 'master':
      return { label: 'Master', color: 'bg-purple-100 text-purple-700 border-purple-200' }
    case 'admin':
      return { label: 'Administrador', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    case 'gerente':
      return { label: 'Gerente', color: 'bg-blue-100 text-blue-700 border-blue-200' }
    case 'operador':
      return { label: 'Operador', color: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 'vendedor':
      return { label: 'Vendedor', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    default:
      return { label: perfil || 'Usuário', color: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}
