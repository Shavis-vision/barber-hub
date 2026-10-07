-- Registro de adiamentos: toda vez que o horário de um agendamento muda, guarda de onde ele veio.
-- Assim o dono vê no Dashboard os horários que foram adiados (sem contar como dinheiro perdido).
CREATE TABLE IF NOT EXISTS public.appointment_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid,
  from_starts_at timestamptz NOT NULL,
  to_starts_at timestamptz NOT NULL,
  customer_name text,
  service_name text,
  price_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_reschedules_shop_from_idx
  ON public.appointment_reschedules(barbershop_id, from_starts_at);

ALTER TABLE public.appointment_reschedules ENABLE ROW LEVEL SECURITY;

-- Só o dono lê. Ninguém grava direto: o registro é criado pelo gatilho abaixo.
DROP POLICY IF EXISTS resched_owner_read ON public.appointment_reschedules;
CREATE POLICY resched_owner_read ON public.appointment_reschedules
  FOR SELECT TO authenticated USING (public.owns_shop(barbershop_id));

REVOKE ALL ON public.appointment_reschedules FROM PUBLIC, anon;
GRANT SELECT ON public.appointment_reschedules TO authenticated;

CREATE OR REPLACE FUNCTION public.log_appointment_reschedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at AND NEW.status IN ('pending', 'confirmed') THEN
    INSERT INTO public.appointment_reschedules
      (appointment_id, barbershop_id, barber_id, from_starts_at, to_starts_at, customer_name, service_name, price_cents)
    VALUES (
      NEW.id, NEW.barbershop_id, OLD.barber_id, OLD.starts_at, NEW.starts_at,
      COALESCE(NEW.customer_name, (SELECT c.name FROM public.customers c WHERE c.id = NEW.customer_id)),
      (SELECT s.name FROM public.services s WHERE s.id = NEW.service_id),
      NEW.price_cents
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.log_appointment_reschedule() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_log_reschedule ON public.appointments;
CREATE TRIGGER appointments_log_reschedule
AFTER UPDATE OF starts_at ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_appointment_reschedule();
