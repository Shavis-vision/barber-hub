import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NewAppointmentDialog, AppointmentDetailDialog } from "@/components/appointment-dialogs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  useAppointmentsRange,
  useBarbers,
  useCustomers,
  useMyShop,
  useUpcomingAppointments,
  type AppointmentRow,
} from "@/lib/shop";
import { hhmm, longDate, money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Navalha" },
      {
        name: "description",
        content: "Visão geral do dia: agendamentos, clientes, barbeiros e faturamento estimado.",
      },
      { property: "og:title", content: "Dashboard — Navalha" },
      { property: "og:description", content: "Visão geral do dia da sua barbearia." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: shop } = useMyShop();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);

  const { from, to } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const { data: today } = useAppointmentsRange(shop?.id, from, to);
  const { data: upcoming } = useUpcomingAppointments(shop?.id, 6);
  const { data: customers } = useCustomers(shop?.id);
  const { data: barbers } = useBarbers(shop?.id);

  const active = (today ?? []).filter((a) => a.status !== "cancelled");
  const revenue = active.reduce((sum, a) => sum + a.price_cents, 0);
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
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Agendamentos hoje" value={String(active.length)} />
        <Stat label="Faturamento estimado" value={money(revenue)} />
        <Stat label="Clientes do dia" value={String(clientsToday)} />
        <Stat
          label="Barbeiros ativos"
          value={String((barbers ?? []).filter((b) => b.active).length)}
        />
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
                    <span className="block truncate text-sm font-medium">{a.customers?.name}</span>
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
