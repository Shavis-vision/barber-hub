import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGate } from "@/components/role-gate";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NewAppointmentDialog, AppointmentDetailDialog } from "@/components/appointment-dialogs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  useAppointmentsRange,
  useBarbers,
  useCustomers,
  useMyShop,
  useUpcomingAppointments,
  type AppointmentRow,
} from "@/lib/shop";
import { addDays, hhmm, longDate, money, shortDate, startOfWeek } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Navalha" },
      {
        name: "description",
        content: "Visão geral do dia: agendamentos, clientes, barbeiros e faturamento.",
      },
      { property: "og:title", content: "Dashboard — Navalha" },
      { property: "og:description", content: "Visão geral do dia da sua barbearia." },
    ],
  }),
  component: () => (
    <RoleGate allow={["owner"]}>
      <DashboardPage />
    </RoleGate>
  ),
});

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

const sumCents = (list: AppointmentRow[]) => list.reduce((sum, a) => sum + a.price_cents, 0);

type RescheduleRow = {
  id: string;
  from_starts_at: string;
  to_starts_at: string;
  customer_name: string | null;
  service_name: string | null;
};

/** Agendamentos adiados: horários originais que caíram no período e foram remarcados. */
function useReschedules(shopId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["reschedules", shopId, from, to],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_reschedules")
        .select("id, from_starts_at, to_starts_at, customer_name, service_name")
        .eq("barbershop_id", shopId!)
        .gte("from_starts_at", from)
        .lt("from_starts_at", to)
        .order("from_starts_at");
      if (error) throw error;
      return (data ?? []) as RescheduleRow[];
    },
  });
}

type LostItem =
  | { kind: "lost"; at: string; appointment: AppointmentRow }
  | { kind: "postponed"; at: string; reschedule: RescheduleRow };

function DashboardPage() {
  const { data: shop } = useMyShop();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [period, setPeriod] = useState<Period>("day");

  const { from, to } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const { from: pFrom, to: pTo } = useMemo(() => periodRange(period), [period]);

  const { data: today } = useAppointmentsRange(shop?.id, from, to);
  const { data: periodAppointments } = useAppointmentsRange(shop?.id, pFrom, pTo);
  const { data: reschedules } = useReschedules(shop?.id, pFrom, pTo);
  const { data: upcoming } = useUpcomingAppointments(shop?.id, 6);
  const { data: customers } = useCustomers(shop?.id);
  const { data: barbers } = useBarbers(shop?.id);

  const active = (today ?? []).filter((a) => a.status !== "cancelled");

  // Faturamento do período escolhido.
  const inPeriod = periodAppointments ?? [];
  const done = inPeriod.filter((a) => a.status === "completed");
  const scheduled = inPeriod.filter((a) => a.status === "confirmed" || a.status === "pending");
  const cancelled = inPeriod.filter((a) => a.status === "cancelled");
  const noShow = inPeriod.filter((a) => a.status === "no_show");
  const realized = sumCents(done);
  const expected = realized + sumCents(scheduled);
  const lostList = [...cancelled, ...noShow].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const lostTotal = sumCents(lostList);
  const postponed = reschedules ?? [];
  const lostItems: LostItem[] = [
    ...lostList.map((appointment) => ({ kind: "lost" as const, at: appointment.starts_at, appointment })),
    ...postponed.map((reschedule) => ({ kind: "postponed" as const, at: reschedule.from_starts_at, reschedule })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const clientsToday = new Set(active.map((a) => a.customer_id)).size;

  return (
    <AppShell
      title="Dashboard"
      description={longDate(new Date())}
      action={
        shop && (
          <Button className="h-11 px-4" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Novo agendamento</span>
          </Button>
        )
      }
    >
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Agendamentos hoje" value={String(active.length)} />
        <Stat label="Clientes do dia" value={String(clientsToday)} />
        <Stat
          label="Barbeiros ativos"
          value={String((barbers ?? []).filter((b) => b.active).length)}
        />
      </section>

      <section className="mt-6 panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Faturamento</h2>
          <div className="flex gap-2" role="group" aria-label="Período do faturamento">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={period === key ? "default" : "outline"}
                onClick={() => setPeriod(key)}
              >
                {PERIOD_LABEL[key]}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="label-caps">Realizado</p>
            <p className="numeric mt-2 text-2xl font-semibold">{money(realized)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {done.length} {done.length === 1 ? "atendimento concluído" : "atendimentos concluídos"}
            </p>
          </div>
          <div>
            <p className="label-caps">Previsto</p>
            <p className="numeric mt-2 text-2xl font-semibold">{money(expected)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Realizado + {scheduled.length} ainda {scheduled.length === 1 ? "agendado" : "agendados"}
            </p>
          </div>
          <div>
            <p className="label-caps">Não realizado</p>
            <p className="numeric mt-2 text-2xl font-semibold">{money(lostTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {cancelled.length} {cancelled.length === 1 ? "cancelado" : "cancelados"} ·{" "}
              {noShow.length} {noShow.length === 1 ? "falta" : "faltas"}
              {postponed.length > 0 &&
                ` · ${postponed.length} ${postponed.length === 1 ? "adiado" : "adiados"}`}
            </p>
          </div>
        </div>

        <Link to="/barbeiros" className="mt-3 inline-block text-sm text-primary">
          Ver resultado por barbeiro
        </Link>

        {lostItems.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="label-caps">Cancelados, faltas e adiados</p>
            <ul className="mt-2 divide-y divide-border">
              {lostItems.slice(0, 8).map((item) =>
                item.kind === "lost" ? (
                  <li key={item.appointment.id}>
                    <button
                      onClick={() => setSelected(item.appointment)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-left transition-colors hover:bg-secondary/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {item.appointment.customer_name ?? item.appointment.customers?.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {shortDate(new Date(item.appointment.starts_at))} · {hhmm(item.appointment.starts_at)} ·{" "}
                          {item.appointment.services?.name} · {money(item.appointment.price_cents)}
                        </span>
                      </span>
                      <StatusBadge status={item.appointment.status} />
                    </button>
                  </li>
                ) : (
                  <li
                    key={item.reschedule.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {item.reschedule.customer_name ?? "Cliente"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {shortDate(new Date(item.reschedule.from_starts_at))} · {hhmm(item.reschedule.from_starts_at)} →{" "}
                        {shortDate(new Date(item.reschedule.to_starts_at))} · {hhmm(item.reschedule.to_starts_at)}
                        {item.reschedule.service_name ? ` · ${item.reschedule.service_name}` : ""}
                      </span>
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      Adiado
                    </span>
                  </li>
                ),
              )}
            </ul>
            {lostItems.length > 8 && (
              <Link to="/agendamentos" className="mt-2 inline-block text-sm text-primary">
                Ver todos em Agendamentos
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 panel">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Próximos horários</h2>
          <Link to="/agendamentos" className="text-sm text-primary">
            Ver todos
          </Link>
        </header>
        {(upcoming ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum agendamento futuro.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(upcoming ?? []).map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="numeric w-16 shrink-0 text-sm font-semibold">
                    {hhmm(a.starts_at)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.customer_name ?? a.customers?.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {shortDate(new Date(a.starts_at))} · {a.services?.name} · {a.barbers?.name}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/barbeiros">
          <Button variant="outline" className="h-12 w-full justify-start">
            Cadastrar barbeiro
          </Button>
        </Link>
        <Link to="/servicos">
          <Button variant="outline" className="h-12 w-full justify-start">
            Cadastrar serviço
          </Button>
        </Link>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        {(customers ?? []).length} clientes cadastrados na sua barbearia.
      </p>

      {shop && (
        <>
          <NewAppointmentDialog shop={shop} open={creating} onOpenChange={setCreating} />
          <AppointmentDetailDialog
            shop={shop}
            appointment={selected}
            onOpenChange={(open) => !open && setSelected(null)}
          />
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="label-caps">{label}</p>
      <p className="numeric mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
