import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppointmentDetailDialog, NewAppointmentDialog } from "@/components/appointment-dialogs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAppointmentsRange, useMyShop, type AppointmentRow } from "@/lib/shop";
import {
  addDays,
  hhmm,
  longDate,
  minutesBetween,
  shortDate,
  startOfWeek,
  toDateKey,
  weekdayShort,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Navalha" },
      {
        name: "description",
        content: "Agenda visual da barbearia por dia e por semana, com horário, cliente e barbeiro.",
      },
      { property: "og:title", content: "Agenda — Navalha" },
      { property: "og:description", content: "Agenda da barbearia por dia e por semana." },
    ],
  }),
  component: AgendaPage,
});

type View = "day" | "week";

function AgendaPage() {
  const { data: shop } = useMyShop();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (view === "day") {
      const end = addDays(anchor, 1);
      return { rangeStart: anchor, rangeEnd: end, days: [anchor] };
    }
    const start = startOfWeek(anchor);
    return {
      rangeStart: start,
      rangeEnd: addDays(start, 7),
      days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    };
  }, [anchor, view]);

  const { data: appointments, isLoading } = useAppointmentsRange(
    shop?.id,
    rangeStart.toISOString(),
    rangeEnd.toISOString(),
  );

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const a of appointments ?? []) {
      const key = toDateKey(new Date(a.starts_at));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [appointments]);

  return (
    <AppShell
      title="Agenda"
      description={
        view === "day"
          ? longDate(anchor)
          : `${shortDate(days[0]!)} – ${shortDate(days[6]!)}`
      }
      action={
        shop && (
          <Button className="h-11 px-4" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        )
      }
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Anterior"
          onClick={() => setAnchor(addDays(anchor, view === "day" ? -1 : -7))}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>

        <div className="flex min-w-0 justify-center gap-1 rounded-lg border border-border bg-card p-1">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "h-9 flex-1 rounded-md px-4 text-sm font-medium transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {v === "day" ? "Dia" : "Semana"}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Próximo"
          onClick={() => setAnchor(addDays(anchor, view === "day" ? 1 : 7))}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-5 space-y-5">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando agenda…</p>}
        {!isLoading &&
          days.map((day) => {
            const key = toDateKey(day);
            const list = byDay.get(key) ?? [];
            return (
              <section key={key} className="panel overflow-hidden">
                <header className="flex items-baseline justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">
                    {weekdayShort(day.getDay())}, {shortDate(day)}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {list.filter((a) => a.status !== "cancelled").length} agendamentos
                  </span>
                </header>

                {list.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum agendamento neste dia.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {list.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => setSelected(a)}
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                        >
                          <span className="w-14 shrink-0">
                            <span className="numeric block text-sm font-semibold">
                              {hhmm(a.starts_at)}
                            </span>
                            <span className="numeric block text-xs text-muted-foreground">
                              {minutesBetween(a.starts_at, a.ends_at)} min
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {a.customers?.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {a.services?.name} · {a.barbers?.name}
                            </span>
                          </span>
                          <StatusBadge status={a.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
      </div>

      {shop && (
        <>
          <NewAppointmentDialog
            shop={shop}
            open={creating}
            onOpenChange={setCreating}
            defaultDate={anchor}
          />
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
