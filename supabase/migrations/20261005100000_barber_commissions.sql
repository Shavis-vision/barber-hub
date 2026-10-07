-- Comissão por barbeiro. Fica em tabela separada, visível só para o dono da barbearia
-- (a tabela barbers é legível por clientes logados e não deve guardar a porcentagem).
CREATE TABLE IF NOT EXISTS public.barber_commissions (
  barber_id uuid PRIMARY KEY REFERENCES public.barbers(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS barber_commissions_shop_idx ON public.barber_commissions(barbershop_id);

ALTER TABLE public.barber_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comm_owner_all ON public.barber_commissions;
CREATE POLICY comm_owner_all ON public.barber_commissions
  FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id))
  WITH CHECK (
    public.owns_shop(barbershop_id)
    AND EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.id = barber_commissions.barber_id
        AND b.barbershop_id = barber_commissions.barbershop_id
    )
  );

REVOKE ALL ON public.barber_commissions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_commissions TO authenticated;
