-- Limita o que um BARBEIRO pode alterar nos próprios agendamentos.
-- Protege o faturamento e a comissão: o barbeiro não muda o valor e só conclui
-- atendimentos que já começaram. O dono e chamadas internas continuam podendo tudo.
CREATE OR REPLACE FUNCTION public.guard_barber_appointment_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Dono da barbearia e chamadas internas (sem usuário logado) podem tudo.
  IF auth.uid() IS NULL OR public.owns_shop(OLD.barbershop_id) THEN
    RETURN NEW;
  END IF;

  -- Barbeiro: não altera valor, vínculos nem origem do agendamento.
  IF NEW.price_cents IS DISTINCT FROM OLD.price_cents
     OR NEW.barbershop_id IS DISTINCT FROM OLD.barbershop_id
     OR NEW.barber_id IS DISTINCT FROM OLD.barber_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.booked_by IS DISTINCT FROM OLD.booked_by
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'O barbeiro não pode alterar valor, serviço, cliente ou barbeiro do agendamento.';
  END IF;

  -- Remarcar: só agendamentos ainda ativos, para um horário futuro e sem mudar o status junto.
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR OLD.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'Só é possível remarcar agendamentos pendentes ou confirmados.';
    END IF;
    IF NEW.starts_at < now() THEN
      RAISE EXCEPTION 'O novo horário precisa estar no futuro.';
    END IF;
  END IF;

  -- Mudança de status.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'Só o dono pode alterar um agendamento já concluído, cancelado ou com falta.';
    END IF;
    IF NEW.status IN ('completed', 'no_show') AND OLD.starts_at > now() THEN
      RAISE EXCEPTION 'Só é possível concluir ou marcar falta depois do horário do atendimento.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_barber_appointment_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_guard_barber_update ON public.appointments;
CREATE TRIGGER appointments_guard_barber_update
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_barber_appointment_update();
