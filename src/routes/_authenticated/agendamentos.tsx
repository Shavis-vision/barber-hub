import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppointmentDetailDialog, NewAppointmentDialog } from "@/components/appointment-dialogs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAppointmentsRange, useMyShop, type AppointmentRow } from "@/lib/shop";
import { hhmm, money, shortDate, STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agendamentos")({
  head: () => ({
    meta: [
      { title: "Agendamentos — Navalha" },
      {
        name: "description",
        content: "Lista de agendamentos da barbearia com filtro por status e ações rápidas.",
      },
      { property: "og:title", content: "Agendamentos — Navalha" },
      { property: "og:description", content: "Todos os agendamentos da sua barbearia." },
    ],
  }),
  component: AppointmentsPage,
});

const FILTERS = ["all", "confirmed", "completed", "cancelled"] as const;

function AppointmentsPage() {
  const { data: shop } = useMyShop();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { from, to } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 30);
    const end = new Date(start);
    end.setDate(end.getDate() + 120);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const { data: appointments, isLoading } = useAppointmentsRange(shop?.id, from, to);
  const list = (appointments ?? []).filter((a) => filter === "all" || a.status === filter);

  return (
    <AppShell
      title="Agendamentos"
      description="Últimos 30 dias e próximos 90"
      action={
        shop && (
          <Button className="h-11 px-4" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        )
      }
    >
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {f === "all" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <section className="mt-4 panel overflow-hidden">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum agendamento encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="w-16 shrink-0">
                    <span className="numeric block text-sm font-semibold">
                      {shortDate(new Date(a.starts_at))}
                    </span>
                    <span className="numeric block text-xs text-muted-foreground">
                      {hhmm(a.starts_at)}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.customers?.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.services?.name} · {a.barbers?.name} · {money(a.price_cents)}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
