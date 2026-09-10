import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Slot = { slot_at: string; barber_id: string };

export async function fetchSlots(
  slug: string,
  serviceId: string,
  barberId: string | null,
  dateKey: string,
) {
  const { data, error } = await supabase.rpc("available_slots", {
    p_slug: slug,
    p_service: serviceId,
    p_barber: barberId,
    p_date: dateKey,
  });
  if (error) throw error;
  return (data ?? []) as unknown as Slot[];
}

export function useAvailableSlots(
  slug: string | undefined,
  serviceId: string | null,
  barberId: string | null,
  dateKey: string | null,
) {
  return useQuery({
    queryKey: ["slots", slug, serviceId, barberId, dateKey],
    enabled: !!slug && !!serviceId && !!dateKey,
    queryFn: () => fetchSlots(slug!, serviceId!, barberId, dateKey!),
    staleTime: 15_000,
  });
}

/** Agrupa horários iguais oferecidos por barbeiros diferentes. */
export function groupSlots(slots: Slot[]) {
  const map = new Map<string, string[]>();
  for (const slot of slots) {
    const list = map.get(slot.slot_at) ?? [];
    list.push(slot.barber_id);
    map.set(slot.slot_at, list);
  }
  return [...map.entries()]
    .map(([slotAt, barberIds]) => ({ slotAt, barberIds }))
    .sort((a, b) => a.slotAt.localeCompare(b.slotAt));
}
