-- Estoque de produtos da barbearia (uso interno do dono; sem vendas).

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0 AND price_cents <= 100000000),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0 AND quantity <= 100000),
  -- Avisa "estoque baixo" quando a quantidade chega a este número (0 = sem aviso).
  min_quantity integer NOT NULL DEFAULT 0 CHECK (min_quantity >= 0 AND min_quantity <= 100000),
  photo_url text CHECK (photo_url IS NULL OR photo_url LIKE 'https://%/storage/v1/object/public/shop-media/%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_barbershop_id_idx ON public.products (barbershop_id);

CREATE OR REPLACE FUNCTION public.products_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_touch_updated_at ON public.products;
CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_touch_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Só o dono da barbearia vê e mexe. Barbeiros, clientes e visitantes não têm acesso.
DROP POLICY IF EXISTS products_owner_all ON public.products;
CREATE POLICY products_owner_all ON public.products
  FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id))
  WITH CHECK (public.owns_shop(barbershop_id));

REVOKE ALL ON public.products FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
