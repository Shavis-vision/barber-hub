import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Barbershop = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  slot_step_minutes: number;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  active: boolean;
};

export type Barber = {
  id: string;
  name: string;
  phone: string | null;
  photo_url: string | null;
  active: boolean;
};

export type WorkingHour = {
  id: string;
  barber_id: string | null;
  weekday: number;
  opens: string;
  closes: string;
  is_open: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  notes: string | null;
  barber_id: string;
  service_id: string;
  customer_id: string;
  customers: { id: string; name: string; phone: string } | null;
  services: { id: string; name: string; duration_minutes: number } | null;
  barbers: { id: string; name: string } | null;
};

const APPOINTMENT_SELECT =
  "id, starts_at, ends_at, status, price_cents, notes, barber_id, service_id, customer_id, customers(id,name,phone), services(id,name,duration_minutes), barbers(id,name)";

export function useMyShop() {
  return useQuery({
    queryKey: ["my-shop"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const { data: existing, error } = await supabase
        .from("barbershops")
        .select("*")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (existing) return existing as unknown as Barbershop;

      const meta = (user.user_metadata ?? {}) as { shop_name?: string; full_name?: string };
      const { error: rpcError } = await supabase.rpc("bootstrap_barbershop", {
        p_name: meta.shop_name ?? "Minha barbearia",
        p_slug: meta.shop_name ?? "barbearia",
      });
      if (rpcError) throw rpcError;

      const { data: created, error: refetch } = await supabase
        .from("barbershops")
        .select("*")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (refetch) throw refetch;
      return (created as unknown as Barbershop) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useServices(shopId?: string) {
  return useQuery({
    queryKey: ["services", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", shopId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Service[];
    },
  });
}

export function useBarbers(shopId?: string) {
  return useQuery({
    queryKey: ["barbers", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("barbershop_id", shopId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Barber[];
    },
  });
}

export function useBarberServices(shopId?: string) {
  return useQuery({
    queryKey: ["barber-services", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barber_services")
        .select("barber_id, service_id")
        .eq("barbershop_id", shopId!);
      if (error) throw error;
      return (data ?? []) as { barber_id: string; service_id: string }[];
    },
  });
}

export function useWorkingHours(shopId?: string) {
  return useQuery({
    queryKey: ["working-hours", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("working_hours")
        .select("id, barber_id, weekday, opens, closes, is_open")
        .eq("barbershop_id", shopId!)
        .order("weekday");
      if (error) throw error;
      return (data ?? []) as unknown as WorkingHour[];
    },
  });
}

export function useCustomers(shopId?: string) {
  return useQuery({
    queryKey: ["customers", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, created_at")
        .eq("barbershop_id", shopId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Customer[];
    },
  });
}

export function useAppointmentsRange(shopId: string | undefined, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ["appointments", shopId, fromISO, toISO],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .eq("barbershop_id", shopId!)
        .gte("starts_at", fromISO)
        .lt("starts_at", toISO)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });
}

export function useUpcomingAppointments(shopId?: string, limit = 8) {
  return useQuery({
    queryKey: ["appointments-upcoming", shopId, limit],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .eq("barbershop_id", shopId!)
        .gte("starts_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("starts_at")
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });
}

export function useCustomerHistory(shopId?: string) {
  return useQuery({
    queryKey: ["customer-history", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("customer_id, starts_at, status")
        .eq("barbershop_id", shopId!)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { customer_id: string; starts_at: string; status: string }[];
    },
  });
}

export { APPOINTMENT_SELECT };
