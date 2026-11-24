-- Personalização da página pública de cada barbearia: ícone, cor do ícone e banner,
-- com opção de enviar logo e foto de banner próprios.

ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS page_icon text NOT NULL DEFAULT 'initials',
  ADD COLUMN IF NOT EXISTS page_icon_color text NOT NULL DEFAULT 'ink',
  ADD COLUMN IF NOT EXISTS page_banner text NOT NULL DEFAULT 'petroleo',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text;

ALTER TABLE public.barbershops
  ADD CONSTRAINT barbershops_page_icon_check
    CHECK (page_icon IN ('initials', 'scissors', 'razor', 'comb', 'image')),
  ADD CONSTRAINT barbershops_page_icon_color_check
    CHECK (page_icon_color IN ('ink', 'petroleo', 'vinho', 'floresta', 'bronze')),
  ADD CONSTRAINT barbershops_page_banner_check
    CHECK (page_banner IN ('petroleo', 'grafite', 'areia', 'vinho', 'floresta',
                           'listras', 'riscado', 'pontilhado', 'quadriculado', 'image')),
  -- Só aceita imagens guardadas no próprio armazenamento do Cortesy (nada de links externos).
  ADD CONSTRAINT barbershops_logo_url_check
    CHECK (logo_url IS NULL OR logo_url LIKE 'https://%/storage/v1/object/public/shop-media/%'),
  ADD CONSTRAINT barbershops_banner_url_check
    CHECK (banner_url IS NULL OR banner_url LIKE 'https://%/storage/v1/object/public/shop-media/%');

-- A tabela usa permissões por coluna: as colunas novas precisam ser liberadas.
GRANT SELECT (page_icon, page_icon_color, page_banner, logo_url, banner_url)
  ON public.barbershops TO anon, authenticated;
GRANT INSERT (page_icon, page_icon_color, page_banner, logo_url, banner_url),
      UPDATE (page_icon, page_icon_color, page_banner, logo_url, banner_url)
  ON public.barbershops TO authenticated;

-- Pasta pública de imagens: cada barbearia grava só na pasta com o próprio id.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-media', 'shop-media', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY shop_media_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'shop-media'
    AND EXISTS (
      SELECT 1 FROM public.barbershops b
      WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY shop_media_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-media'
    AND EXISTS (
      SELECT 1 FROM public.barbershops b
      WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY shop_media_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'shop-media'
    AND EXISTS (
      SELECT 1 FROM public.barbershops b
      WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_id = auth.uid()
    )
  );
