import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { useAccessProfile } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Navalha" },
      {
        name: "description",
        content: "Seus dados de barbeiro e os serviços que você realiza na barbearia.",
      },
      { property: "og:title", content: "Meu perfil — Navalha" },
      { property: "og:description", content: "Seus dados e serviços como barbeiro." },
    ],
  }),
  component: () => (
    <RoleGate allow={["owner", "barber"]}>
      <ProfilePage />
    </RoleGate>
  ),
});

function ProfilePage() {
  const { data: profile } = useAccessProfile();
  const barberId = profile?.barberId ?? null;

  const { data } = useQuery({
    queryKey: ["my-barber", barberId],
    enabled: !!barberId,
    queryFn: async () => {
      const [{ data: barber }, { data: links }] = await Promise.all([
        supabase.from("barbers").select("name, phone, active").eq("id", barberId!).maybeSingle(),
        supabase.from("barber_services").select("service_id").eq("barber_id", barberId!),
      ]);
      const ids = (links ?? []).map((l) => l.service_id);
      const { data: services } = ids.length
        ? await supabase
            .from("services")
            .select("id, name, price_cents, duration_minutes")
            .in("id", ids)
            .order("name")
        : { data: [] };
      return {
        barber: barber as { name: string; phone: string | null; active: boolean } | null,
        services: (services ?? []) as {
          id: string;
          name: string;
          price_cents: number;
          duration_minutes: number;
        }[],
      };
    },
  });

  return (
    <AppShell title="Meu perfil" description="Seus dados e serviços">
      {!barberId ? (
        <p className="panel p-5 text-sm text-muted-foreground">
          Sua conta ainda não está vinculada a uma ficha de barbeiro. O dono da barbearia pode
          fazer esse vínculo.
        </p>
      ) : (
        <>
          <section className="panel p-4 sm:p-5">
            <p className="label-caps">Barbeiro</p>
            <p className="mt-1.5 text-lg font-semibold">{data?.barber?.name ?? "—"}</p>
            <p className="numeric mt-1 text-sm text-muted-foreground">
              {data?.barber?.phone ?? "Telefone não informado"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {data?.barber?.active ? "Ativo na agenda" : "Inativo na agenda"}
            </p>
          </section>

          <section className="mt-6 panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Serviços que você realiza</h2>
            </header>
            {(data?.services ?? []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum serviço vinculado.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(data?.services ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="truncate text-sm font-medium">{s.name}</span>
                    <span className="numeric shrink-0 text-sm text-muted-foreground">
                      {money(s.price_cents)} · {s.duration_minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
