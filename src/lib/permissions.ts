export type UserRole = 'master' | 'admin' | 'gerente' | 'vendedor' | 'operador'

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
  if (!userRole) return false
  const userLevel = ROLE_HIERARCHY[userRole.toLowerCase() as UserRole] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
  return userLevel >= requiredLevel
}

export function canManageUsers(perfil?: string | null): boolean {
  return hasMinimumRole(perfil, 'admin')
}

export function canManageProducts(perfil?: string | null): boolean {
  return hasMinimumRole(perfil, 'gerente')
}

export function canManageFinance(perfil?: string | null): boolean {
  return hasMinimumRole(perfil, 'gerente')
}

export function canMakeSales(perfil?: string | null): boolean {
  return hasMinimumRole(perfil, 'vendedor')
}

export function canManageStock(perfil?: string | null): boolean {
  return hasMinimumRole(perfil, 'operador')
}

export function formatPerfilBadge(perfil?: string | null): { label: string; color: string } {
  switch (perfil?.toLowerCase()) {
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
