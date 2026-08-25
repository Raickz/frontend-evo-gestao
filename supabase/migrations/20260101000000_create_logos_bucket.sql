-- Migration: Configuração do bucket de Storage 'logos' para logos das empresas
-- Formatos permitidos: image/jpeg, image/png, image/webp
-- Limite de tamanho: 5MB (5242880 bytes)
-- Bucket público para leitura direta de URLs públicas

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- RLS Policies para storage.objects no bucket 'logos'

-- 1. SELECT: Qualquer usuário autenticado pode ver logos (bucket público)
DROP POLICY IF EXISTS "logos_storage_select" ON storage.objects;
CREATE POLICY "logos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
  );

-- 2. INSERT: Usuário só pode fazer upload em {empresa_id}/logo.* onde empresa_id corresponde ao empresa_id do usuário autenticado
DROP POLICY IF EXISTS "logos_storage_insert" ON storage.objects;
CREATE POLICY "logos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
    AND (
      public.is_admin()
      OR public.is_master()
    )
  );

-- 3. UPDATE: mesma regra do INSERT
DROP POLICY IF EXISTS "logos_storage_update" ON storage.objects;
CREATE POLICY "logos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
    AND (
      public.is_admin()
      OR public.is_master()
    )
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
    AND (
      public.is_admin()
      OR public.is_master()
    )
  );

-- 4. DELETE: mesma regra do INSERT
DROP POLICY IF EXISTS "logos_storage_delete" ON storage.objects;
CREATE POLICY "logos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (
      (storage.foldername(name))[1] = public.get_my_empresa_id()::text
      OR public.is_admin()
      OR public.is_master()
    )
    AND (
      public.is_admin()
      OR public.is_master()
    )
  );
