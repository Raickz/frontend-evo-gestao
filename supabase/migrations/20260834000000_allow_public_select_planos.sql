-- Permite leitura pública / anônima da tabela planos para página pública de planos e setup
DROP POLICY IF EXISTS "planos_select_authenticated" ON public.planos;
DROP POLICY IF EXISTS "planos_select_public" ON public.planos;

CREATE POLICY "planos_select_public" ON public.planos
  FOR SELECT TO anon, authenticated
  USING (ativo = true);
