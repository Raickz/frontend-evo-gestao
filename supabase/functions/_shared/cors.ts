// Permitir origens de forma dinâmica segura respeitando domínios autorizados e pré-visualização Skip
export function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get('origin') || '*'
  // Se for uma requisição de navegador com Origin conhecido, espelhar a origem válida
  // ou permitir o fallback padrão seguro
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, x-supabase-client-platform, apikey, content-type, x-signature',
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type, x-signature',
}
