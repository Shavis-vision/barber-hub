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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Início — Cortesy" },
      {
        name: "description",
        content: "Visão geral do dia: agendamentos, clientes, barbeiros e faturamento.",
      },
      { property: "og:title", content: "Início — Cortesy" },
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
  const todayActive = [...active].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  const todayDone = todayActive.filter((a) => a.status === "completed");
  const todayExpected = sumCents(todayActive.filter((a) => a.status !== "no_show"));
  const next = (upcoming ?? []).find((a) => a.status === "confirmed" || a.status === "pending");
  const nextPhone = next?.customers?.phone?.replace(/\D/g, "");

  return (
    <AppShell
      title="Início"
      description={longDate(new Date())}
      action={
        shop && (
          <Button className="h-11 px-4" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            Agendar
          </Button>
        )
      }
    >
      <section className="rounded-3xl bg-hero p-5 text-white" aria-label="Próximo cliente">
        {next ? (
          <>
            <p className="text-sm text-white/85">Próximo cliente · {whenLabel(next.starts_at)}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="display-num text-[56px] leading-none font-bold">{hhmm(next.starts_at)}</span>
              <div className="min-w-0">
                <p className="truncate text-lg leading-snug font-semibold">
                  {next.customer_name ?? next.customers?.name}
                </p>
                <p className="truncate text-sm text-white/85">
                  {next.services?.name} · {next.barbers?.name}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setSelected(next)}
                className="press h-11 flex-1 rounded-xl bg-white text-sm font-semibold text-[#12485a]"
              >
                Ver agendamento
              </button>
              {nextPhone && nextPhone.length >= 10 && (
                <a
                  href={`https://wa.me/55${nextPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press flex h-11 flex-1 items-center justify-center rounded-xl border border-white/45 text-sm font-semibold"
                >
                  Chamar no WhatsApp
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-white/85">Próximo cliente</p>
            <p className="mt-1 text-lg font-semibold">Nenhum horário marcado por enquanto.</p>
            <p className="mt-1 text-sm text-white/85">
              Divulgue o link da sua página para os clientes agendarem sozinhos.
            </p>
            {shop && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/barbearia/${shop.slug}`);
                    toast.success("Link copiado.");
                  } catch {
                    toast.error("Não foi possível copiar o link.");
                  }
                }}
                className="press mt-4 h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[#12485a]"
              >
                Copiar link da minha página
              </button>
            )}
          </>
        )}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <Stat
          label="Atendimentos hoje"
          value={String(todayActive.length)}
          hint={`${todayDone.length} ${todayDone.length === 1 ? "concluído" : "concluídos"}`}
        />
        <Stat
          label="Previsto hoje"
          value={money(todayExpected)}
          hint={`${money(sumCents(todayDone))} já recebidos`}
        />
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Agenda de hoje</h2>
          <Link to="/agenda" className="flex h-11 items-center text-sm font-semibold text-primary">
            Ver agenda
          </Link>
        </div>
        <div className="panel">
          {todayActive.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum horário hoje.</p>
          ) : (
            <ul className="divide-y divide-border">
              {todayActive.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setSelected(a)}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                  >
                    <span
                      className={cn(
                        "display-num w-14 text-xl font-bold",
                        a.status === "completed" && "text-muted-foreground",
                      )}
                    >
                      {hhmm(a.starts_at)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{a.customer_name ?? a.customers?.name}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        {a.services?.name} · {a.barbers?.name}
                      </span>
                    </span>
                    <StatusBadge status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Faturamento</h2>
          <div className="flex gap-2" role="group" aria-label="Período do faturamento">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm" className="h-11 px-4"
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
            <p className="display-num mt-2 text-[28px] leading-none font-bold">{money(realized)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {done.length} {done.length === 1 ? "atendimento concluído" : "atendimentos concluídos"}
            </p>
          </div>
          <div>
            <p className="label-caps">Previsto</p>
            <p className="display-num mt-2 text-[28px] leading-none font-bold">{money(expected)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Realizado + {scheduled.length} ainda {scheduled.length === 1 ? "agendado" : "agendados"}
            </p>
          </div>
          <div>
            <p className="label-caps">Não realizado</p>
            <p className="display-num mt-2 text-[28px] leading-none font-bold">{money(lostTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {cancelled.length} {cancelled.length === 1 ? "cancelado" : "cancelados"} ·{" "}
              {noShow.length} {noShow.length === 1 ? "falta" : "faltas"}
              {postponed.length > 0 &&
                ` · ${postponed.length} ${postponed.length === 1 ? "adiado" : "adiados"}`}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-5">
          <Link to="/barbeiros" className="flex h-11 items-center text-sm font-semibold text-primary">
            Resultado por barbeiro
          </Link>
          <Link to="/alteracoes" className="flex h-11 items-center text-sm font-semibold text-primary">
            Cancelamentos e remarcações
          </Link>
        </div>

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
        {(customers ?? []).length}{" "}
        {(customers ?? []).length === 1 ? "cliente cadastrado" : "clientes cadastrados"} na sua barbearia.
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

function whenLabel(iso: string) {
  const start = new Date(iso);
  const now = new Date();
  const minutes = Math.round((start.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return "agora";
  if (minutes < 60) return `em ${minutes} min`;
  if (start.toDateString() === now.toDateString()) return "hoje";
  if (start.toDateString() === addDays(now, 1).toDateString()) return "amanhã";
  return shortDate(start);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="display-num mt-1.5 text-[30px] leading-none font-bold whitespace-nowrap">{value}</p>
      {hint && <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
