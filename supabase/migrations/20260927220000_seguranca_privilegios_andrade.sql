-- Migration: 20260927220000_seguranca_privilegios_andrade.sql
-- Descrição: Hardening de privilégios de execução no schema public
-- 1. Revoga EXECUTE de PUBLIC e anon nas funções novas e recriadas da Rodada Andrade
-- 2. Concede EXECUTE exclusivamente para authenticated (e service_role / postgres)
-- 3. Mantém is_platform_admin() com EXECUTE para anon (exigência da policy public de planos)
-- 4. Ajusta ALTER DEFAULT PRIVILEGES para os papéis postgres e supabase_admin

-- 1. Revogar de todas as funções do schema public para PUBLIC e anon
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- 2. Conceder EXECUTE para authenticated em todas as funções do schema public
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 3. Exceção estrita e necessária: is_platform_admin para consulta pública de planos
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon;

-- 4. Alter Default Privileges para postgres
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- 5. Alter Default Privileges para supabase_admin (se suportado pelo ambiente Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    BEGIN
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Sem privilégio para ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin, ignorado.';
      WHEN others THEN
        RAISE NOTICE 'Aviso ao aplicar default privileges para supabase_admin: %', SQLERRM;
    END;
  END IF;
END $$;
