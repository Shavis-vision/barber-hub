import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { addDays, money, startOfWeek } from "@/lib/format";
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

          {profile?.role === "barber" && <MyResult barberId={barberId} />}

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

type Period = "day" | "week" | "month";
const PERIOD_LABEL: Record<Period, string> = { day: "Hoje", week: "Semana", month: "Mês" };

function periodRange(period: Period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (period === "week") {
    const start = startOfWeek(today);
    return { from: start.toISOString(), to: addDays(start, 7).toISOString() };
  }
  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
}

function MyResult({ barberId }: { barberId: string }) {
  const [period, setPeriod] = useState<Period>("day");
  const { from, to } = useMemo(() => periodRange(period), [period]);

  const { data } = useQuery({
    queryKey: ["my-result", barberId, from, to],
    queryFn: async () => {
      // RLS: o barbeiro só lê os próprios agendamentos e a própria comissão.
      const [{ data: appts, error }, { data: comm }] = await Promise.all([
        supabase
          .from("appointments")
          .select("price_cents")
          .eq("barber_id", barberId)
          .eq("status", "completed")
          .gte("starts_at", from)
          .lt("starts_at", to),
        supabase.from("barber_commissions").select("percent").eq("barber_id", barberId).maybeSingle(),
      ]);
      if (error) throw error;
      const total = (appts ?? []).reduce((sum, a) => sum + (a.price_cents ?? 0), 0);
      return { count: (appts ?? []).length, total, percent: comm ? Number(comm.percent) : null };
    },
  });

  const percent = data?.percent ?? null;

  return (
    <section className="mt-6 panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Meu resultado</h2>
        <div className="flex gap-2" role="group" aria-label="Período do resultado">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
            <Button key={key} type="button" className="h-10" variant={period === key ? "default" : "outline"} onClick={() => setPeriod(key)}>
              {PERIOD_LABEL[key]}
            </Button>
          ))}
        </div>
      </header>
      <dl className="grid grid-cols-2 divide-x divide-border">
        <div className="p-4">
          <dt className="label-caps">Clientes atendidos</dt>
          <dd className="numeric mt-1 text-xl font-semibold">{data?.count ?? 0}</dd>
        </div>
        <div className="p-4">
          <dt className="label-caps">Faturado</dt>
          <dd className="numeric mt-1 text-xl font-semibold">{money(data?.total ?? 0)}</dd>
        </div>
      </dl>
      {percent !== null && percent > 0 && (
        <p className="numeric border-t border-border px-4 py-3 text-sm">
          Minha comissão: {percent}% · {money(Math.round(((data?.total ?? 0) * percent) / 100))}
        </p>
      )}
    </section>
  );
}
