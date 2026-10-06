import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "owner" | "barber" | "client";

export type AccessProfile = {
  userId: string | null;
  role: Role;
  /** Preenchido quando o usuário autenticado está vinculado a uma ficha de barbeiro. */
  barberId: string | null;
  barbershopId: string | null;
};

const GUEST: AccessProfile = { userId: null, role: "client", barberId: null, barbershopId: null };

/**
 * Papel do usuário autenticado. A verdade fica no banco (user_roles + barbers.user_id);
 * aqui apenas lemos para adaptar a interface. A proteção real é RLS + guarda de rota.
 */
export function useAccessProfile() {
  const { data: sessionUserId } = useQuery({
    queryKey: ["access-profile", "session-user"],
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id ?? null;
    },
  });
  return useQuery({
    queryKey: ["access-profile", sessionUserId ?? "guest"],
    enabled: sessionUserId !== undefined,
    staleTime: 60_000,
    queryFn: async (): Promise<AccessProfile> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || user.id !== sessionUserId) return GUEST;

      const [{ data: roles }, { data: barber }] = await Promise.all([
        supabase.from("user_roles").select("role, barbershop_id").eq("user_id", user.id),
        supabase
          .from("barbers")
          .select("id, barbershop_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const list = (roles ?? []) as { role: Role; barbershop_id: string | null }[];
      const owner = list.find((r) => r.role === "owner");
      if (owner) {
        return {
          userId: user.id,
          role: "owner",
          barberId: barber?.id ?? null,
          barbershopId: owner.barbershop_id ?? barber?.barbershop_id ?? null,
        };
      }

      if (barber) {
        return {
          userId: user.id,
          role: "barber",
          barberId: barber.id,
          barbershopId: barber.barbershop_id,
        };
      }

      const hasBarberRole = list.some((r) => r.role === "barber");
      return {
        userId: user.id,
        role: hasBarberRole ? "barber" : "client",
        barberId: null,
        barbershopId: list[0]?.barbershop_id ?? null,
      };
    },
  });
}

/** Rota inicial de cada papel dentro da área autenticada. */
export function homeForRole(role: Role) {
  if (role === "owner") return "/dashboard" as const;
  if (role === "barber") return "/agenda" as const;
  return "/cliente" as const;
}
