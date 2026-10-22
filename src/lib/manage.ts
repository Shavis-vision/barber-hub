import { supabase } from "@/integrations/supabase/client";

/** Antecedência mínima para cancelar/remarcar. A regra de verdade fica no banco; isto só orienta a tela. */
export const MIN_NOTICE_HOURS = 2;

export type ManageTarget = { kind: "token"; token: string } | { kind: "mine"; id: string };

export function isActiveStatus(status: string) {
  return status === "pending" || status === "confirmed";
}

export function canChange(startsAt: string, status: string, now = Date.now()) {
  return (
    isActiveStatus(status) && new Date(startsAt).getTime() - now >= MIN_NOTICE_HOURS * 3600_000
  );
}

// As funções novas ainda não estão nos tipos gerados do Supabase.
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function cancelAppointment(target: ManageTarget) {
  const { error } =
    target.kind === "token"
      ? await rpc("cancel_managed_appointment", { p_token: target.token })
      : await rpc("cancel_my_appointment", { p_id: target.id });
  if (error) throw new Error(error.message);
}

export async function rescheduleAppointment(target: ManageTarget, slot: string) {
  const { error } =
    target.kind === "token"
      ? await rpc("reschedule_managed_appointment", { p_token: target.token, p_slot: slot })
      : await rpc("reschedule_my_appointment", { p_id: target.id, p_slot: slot });
  if (error) throw new Error(error.message);
}

export type ManagedAppointment = {
  found: boolean;
  status: string;
  starts_at: string;
  ends_at: string;
  price_cents: number;
  service_id: string;
  barber_id: string;
  shop_name: string;
  shop_slug: string;
  shop_phone: string | null;
  service_name: string;
  barber_name: string;
  change_deadline: string;
  can_change: boolean;
};

export async function getManagedAppointment(token: string) {
  const { data, error } = await rpc("get_managed_appointment", { p_token: token });
  if (error) throw new Error(error.message);
  return data as ManagedAppointment;
}

export function manageUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/agendamento/${token}`;
}

export type RescheduleSlot = { slot_at: string; barber_id: string };

/** Horários livres para remarcar (mesmo serviço e barbeiro), sem contar o próprio agendamento. */
export async function fetchRescheduleSlots(target: ManageTarget, dateKey: string) {
  const { data, error } =
    target.kind === "token"
      ? await rpc("managed_available_slots", { p_token: target.token, p_date: dateKey })
      : await rpc("my_available_slots", { p_id: target.id, p_date: dateKey });
  if (error) throw new Error(error.message);
  return (data ?? []) as RescheduleSlot[];
}
