-- Migration: 20260925164500_limpeza_seguranca_rodada_f.sql
-- Descrição: Rodada F — Limpeza de Segurança Pós-Testes
-- 1. Remoção de funções de teste / diagnóstico que não devem existir em produção
-- 2. Revogação de privilégios de execução de PUBLIC e anon nas funções do schema public
-- 3. Concessão de EXECUTE para authenticated em todas as funções legítimas da aplicação
-- 4. Concessão de EXECUTE para anon apenas nas funções necessárias (ex: is_platform_admin para RLS em planos)
-- 5. Configuração de ALTER DEFAULT PRIVILEGES para futuras funções
-- 6. Fixação de search_path em sp_now, sp_date e sp_month_start

-- ============================================================================
-- 1. DROP DE FUNÇÕES DE TESTE / DIAGNÓSTICO
-- ============================================================================
DROP FUNCTION IF EXISTS public.executar_teste_conciliacao_c1();
DROP FUNCTION IF EXISTS public.executar_teste_seguranca_b3();
DROP FUNCTION IF EXISTS public._test_rls_perfil(uuid, text);

-- ============================================================================
-- 2. AJUSTAR SEARCH_PATH NAS FUNÇÕES DE DATA/HORA (sp_now, sp_date, sp_month_start)
-- Mantendo comportamento original no fuso America/Sao_Paulo com search_path seguro
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sp_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT now() AT TIME ZONE 'America/Sao_Paulo';
$$;

CREATE OR REPLACE FUNCTION public.sp_date(p_ts timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT (p_ts AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

CREATE OR REPLACE FUNCTION public.sp_month_start(p_ts timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT (date_trunc('month', p_ts AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');
$$;

-- ============================================================================
-- 3. REVOGAÇÃO GERAL DE PRIVILÉGIOS DE EXECUÇÃO
-- ============================================================================
-- Revogar privilégio padrão herdado de PUBLIC e anon em todas as funções do schema public
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- ============================================================================
-- 4. CONCESSÃO DE EXECUTE PARA authenticated
-- Todas as funções operacionais, administrativas e auxiliares de RLS
-- ============================================================================
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- 5. CONCESSÃO DE EXECUTE PARA anon (SOMENTE O ESTRITAMENTE NECESSÁRIO)
-- 'is_platform_admin' é referenciada pela policy RLS planos_select_public da tabela planos
-- ('ativo = true OR is_platform_admin()'). Ao conceder EXECUTE anon, a consulta pública à
-- tabela de planos avalia is_platform_admin() como falso sem erro de permissão.
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon;

-- ============================================================================
-- 6. ALTER DEFAULT PRIVILEGES
-- Garante que qualquer função criada futuramente no schema public não nasça executável por anon/PUBLIC
-- ============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
