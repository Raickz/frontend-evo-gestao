-- ============================================================================
-- MIGRATION: 20260923061000_cleanup_test_suite_rls.sql
-- Limpeza das tabelas e funções de teste temporárias
-- ============================================================================

DROP TABLE IF EXISTS public._test_rls_results CASCADE;
DROP FUNCTION IF EXISTS public._test_rls_perfil(uuid, text) CASCADE;
