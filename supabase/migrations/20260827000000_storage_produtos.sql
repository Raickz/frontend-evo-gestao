-- Migration: Configuração do bucket de Storage 'produtos' para fotos de produtos
-- Formatos permitidos: image/jpeg, image/png, image/webp
-- Limite de tamanho: 5MB (5242880 bytes)
-- Bucket público para leitura direta de URLs públicas

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produtos',
  'produtos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- RLS Policies para storage.objects no bucket 'produtos'

-- 1. SELECT: Qualquer usuário autenticado da empresa pode visualizar fotos dos produtos da empresa
DROP POLICY IF EXISTS "produtos_storage_select" ON storage.objects;
CREATE POLICY "produtos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'produtos'
    AND (
      -- Verifica se o primeiro segmento do path corresponde à empresa do usuário
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
  );

-- 2. INSERT: Usuários autenticados com permissão (admin/manager/operador/master) podem enviar fotos para a pasta da sua empresa
DROP POLICY IF EXISTS "produtos_storage_insert" ON storage.objects;
CREATE POLICY "produtos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'produtos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
    AND (
      public.is_admin()
      OR public.is_master()
      OR public.is_manager_or_above()
    )
  );

-- 3. UPDATE: Usuários autorizados podem atualizar arquivos na pasta da empresa
DROP POLICY IF EXISTS "produtos_storage_update" ON storage.objects;
CREATE POLICY "produtos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'produtos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
    AND (
      public.is_admin()
      OR public.is_master()
      OR public.is_manager_or_above()
    )
  )
  WITH CHECK (
    bucket_id = 'produtos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
  );

-- 4. DELETE: Usuários autorizados podem excluir fotos
DROP POLICY IF EXISTS "produtos_storage_delete" ON storage.objects;
CREATE POLICY "produtos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'produtos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
    AND (
      public.is_admin()
      OR public.is_master()
      OR public.is_manager_or_above()
    )
  );
