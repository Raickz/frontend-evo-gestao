export type UserRole = 'master' | 'admin' | 'gerente' | 'vendedor' | 'operador'

export type AppPage =
  | 'dashboard'
  | 'clientes'
  | 'produtos'
  | 'estoque'
  | 'vendas'
  | 'pedidos'
  | 'financeiro'
  | 'vendedores'
  | 'comissoes'
  | 'configuracoes'

/**
 * Matriz explícita de permissões por perfil (sem herança implícita).
 *
 * MASTER: acesso completo — Dashboard, Clientes, Produtos, Estoque, Vendas, Pedidos, Financeiro, Vendedores, Comissões, Configurações
 * ADMIN: Dashboard, Clientes, Produtos, Estoque, Vendas, Pedidos, Financeiro, Vendedores, Comissões, Configurações
 * GERENTE: Dashboard, Clientes, Produtos, Estoque, Vendas, Pedidos, Financeiro, Comissões
 * VENDEDOR: Dashboard, Clientes, Vendas, Pedidos
 * OPERADOR: Dashboard, Produtos, Estoque
 */
export const ROLE_PAGES: Record<UserRole, readonly AppPage[]> = {
  master: [
    'dashboard',
    'clientes',
    'produtos',
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
    'clientes',
    'produtos',
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
    'clientes',
    'produtos',
    'estoque',
    'vendas',
    'pedidos',
    'financeiro',
    'comissoes',
  ],
  vendedor: ['dashboard', 'clientes', 'vendas', 'pedidos'],
  operador: ['dashboard', 'produtos', 'estoque'],
}

/**
 * Mapeamento de rotas/caminhos para identificador de página AppPage.
 */
export const PATH_TO_PAGE_MAP: Record<string, AppPage> = {
  '/app/dashboard': 'dashboard',
  '/app/clientes': 'clientes',
  '/app/produtos': 'produtos',
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
export function normalizeRole(perfil?: string | null): UserRole | null {
  if (!perfil) return null
  const normalized = perfil.trim().toLowerCase()
  if (['master', 'admin', 'gerente', 'vendedor', 'operador'].includes(normalized)) {
    return normalized as UserRole
  }
  return null
}

/**
 * Retorna se o perfil fornecido pode acessar determinada página.
 */
export function canAccessPage(perfil: string | null | undefined, page: AppPage | string): boolean {
  const role = normalizeRole(perfil)
  if (!role) return false

  // Se passou uma rota como '/app/clientes' ou 'clientes'
  const targetPage: AppPage | undefined =
    PATH_TO_PAGE_MAP[page] ||
    (Object.values(PATH_TO_PAGE_MAP).includes(page as AppPage) ? (page as AppPage) : undefined)

  if (!targetPage) return false

  const allowedPages = ROLE_PAGES[role]
  return allowedPages.includes(targetPage)
}

/**
 * Retorna o conjunto / array de páginas permitidas para o perfil.
 */
export function getAllowedPages(perfil?: string | null): readonly AppPage[] {
  const role = normalizeRole(perfil)
  if (!role) return []
  return ROLE_PAGES[role]
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  master: 5,
  admin: 4,
  gerente: 3,
  vendedor: 2,
  operador: 1,
}

export function hasMinimumRole(
  userRole: string | undefined | null,
  requiredRole: UserRole,
): boolean {
  const role = normalizeRole(userRole)
  if (!role) return false
  const userLevel = ROLE_HIERARCHY[role] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
  return userLevel >= requiredLevel
}

export function canManageUsers(perfil?: string | null): boolean {
  return canAccessPage(perfil, 'vendedores') || canAccessPage(perfil, 'configuracoes')
}

export function canManageProducts(perfil?: string | null): boolean {
  return canAccessPage(perfil, 'produtos')
}

export function canManageFinance(perfil?: string | null): boolean {
  return canAccessPage(perfil, 'financeiro')
}

export function canMakeSales(perfil?: string | null): boolean {
  return canAccessPage(perfil, 'vendas')
}

export function canManageStock(perfil?: string | null): boolean {
  return canAccessPage(perfil, 'estoque')
}

export function formatPerfilBadge(perfil?: string | null): { label: string; color: string } {
  const role = normalizeRole(perfil)
  switch (role) {
    case 'master':
      return { label: 'Master', color: 'bg-purple-100 text-purple-800 border-purple-200' }
    case 'admin':
      return { label: 'Administrador', color: 'bg-teal-100 text-teal-800 border-teal-200' }
    case 'gerente':
      return { label: 'Gerente', color: 'bg-blue-100 text-blue-800 border-blue-200' }
    case 'vendedor':
      return { label: 'Vendedor', color: 'bg-amber-100 text-amber-800 border-amber-200' }
    case 'operador':
      return { label: 'Operador', color: 'bg-slate-100 text-slate-800 border-slate-200' }
    default:
      return { label: perfil || 'Usuário', color: 'bg-gray-100 text-gray-800 border-gray-200' }
  }
}
