import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { supabase } from "@/integrations/supabase/client";
import { hhmm, money, shortDate } from "@/lib/format";
import { useBarbers, useMyShop } from "@/lib/shop";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alteracoes")({
  head: () => ({
    meta: [
      { title: "Alterações — Cortezy" },
      {
        name: "description",
        content: "Cancelamentos e remarcações, com quem fez e com quanta antecedência.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["owner"]}>
      <ChangesPage />
    </RoleGate>
  ),
});

type Change = {
  id: string;
  kind: "cancelled" | "rescheduled";
  actor: "client" | "owner" | "barber" | "system";
  barber_id: string | null;
  from_starts_at: string;
  to_starts_at: string | null;
  customer_name: string | null;
  service_name: string | null;
  price_cents: number;
  created_at: string;
};

const ACTOR_LABEL: Record<Change["actor"], string> = {
  client: "Cliente",
  owner: "Você (dono)",
  barber: "Barbeiro",
  system: "Sistema",
};

const PERIODS = [
  { key: 7, label: "7 dias" },
  { key: 30, label: "30 dias" },
  { key: 90, label: "90 dias" },
] as const;

function useChanges(shopId: string | undefined, days: number) {
  return useQuery({
    queryKey: ["appointment-changes", shopId, days],
    enabled: !!shopId,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      // A tabela é nova e ainda não está nos tipos gerados do Supabase.
      const { data, error } = await supabase
        .from("appointment_changes" as never)
        .select(
          "id, kind, actor, barber_id, from_starts_at, to_starts_at, customer_name, service_name, price_cents, created_at",
        )
        .eq("barbershop_id" as never, shopId!)
        .gte("created_at" as never, since)
        .order("created_at" as never, { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Change[];
    },
  });
}

/** Quanto tempo faltava para o horário original quando a alteração foi feita. */
function notice(c: Change) {
  const mins = Math.round(
    (new Date(c.from_starts_at).getTime() - new Date(c.created_at).getTime()) / 60000,
  );
  if (mins < 0) return { text: "depois do horário", late: true };
  if (mins < 60) return { text: `${mins} min antes`, late: true };
  const h = Math.floor(mins / 60);
  if (h < 48) return { text: `${h} h antes`, late: h < 2 };
  return { text: `${Math.floor(h / 24)} dias antes`, late: false };
}

function ChangesPage() {
  const { data: shop } = useMyShop();
  const { data: barbers } = useBarbers(shop?.id);
  const [days, setDays] = useState<number>(30);
  const [kind, setKind] = useState<"all" | Change["kind"]>("all");
  const [actor, setActor] = useState<"all" | Change["actor"]>("all");
  const { data, isLoading, isError } = useChanges(shop?.id, days);

  const all = data ?? [];
  const list = useMemo(
    () =>
      all.filter(
        (c) => (kind === "all" || c.kind === kind) && (actor === "all" || c.actor === actor),
      ),
    [all, kind, actor],
  );
  const barberName = (id: string | null) => barbers?.find((b) => b.id === id)?.name;

  const cancelled = all.filter((c) => c.kind === "cancelled");
  const rescheduled = all.filter((c) => c.kind === "rescheduled");

  return (
    <AppShell
      title="Alterações"
      description="Cancelamentos e remarcações — quem fez e com quanta antecedência"
    >
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Cancelamentos"
          value={cancelled.length}
          hint={money(cancelled.reduce((s, c) => s + c.price_cents, 0))}
        />
        <Stat label="Remarcações" value={rescheduled.length} />
      </div>

      <Chips
        className="mt-4"
        value={days}
        onChange={setDays}
        options={PERIODS.map((p) => ({ value: p.key as number, label: p.label }))}
      />
      <Chips
        className="mt-2"
        value={kind}
        onChange={setKind}
        options={[
          { value: "all", label: "Todos" },
          { value: "cancelled", label: "Cancelamentos" },
          { value: "rescheduled", label: "Remarcações" },
        ]}
      />
      <Chips
        className="mt-2"
        value={actor}
        onChange={setActor}
        options={[
          { value: "all", label: "Qualquer pessoa" },
          { value: "client", label: "Cliente" },
          { value: "owner", label: "Dono" },
          { value: "barber", label: "Barbeiro" },
        ]}
      />

      <section className="mt-4 panel overflow-hidden">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : isError ? (
          <p role="alert" className="px-4 py-8 text-center text-sm text-destructive">
            Não foi possível carregar as alterações.
          </p>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma alteração no período. O histórico começa a ser registrado a partir da data em
            que esta tela foi publicada.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((c) => {
              const n = notice(c);
              return (
                <li key={c.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.customer_name ?? "Cliente"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.service_name, barberName(c.barber_id), money(c.price_cents)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        c.kind === "cancelled"
                          ? "border-destructive/40 bg-destructive/5 text-destructive"
                          : "border-border bg-secondary text-secondary-foreground",
                      )}
                    >
                      {c.kind === "cancelled" ? "Cancelado" : "Remarcado"}
                    </span>
                  </div>
                  <p className="numeric mt-1.5 text-sm">
                    {shortDate(new Date(c.from_starts_at))} {hhmm(c.from_starts_at)}
                    {c.to_starts_at && (
                      <>
                        {" "}
                        → {shortDate(new Date(c.to_starts_at))} {hhmm(c.to_starts_at)}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ACTOR_LABEL[c.actor]} · feito em {shortDate(new Date(c.created_at))}{" "}
                    {hhmm(c.created_at)} ·{" "}
                    <span className={cn(n.late && "font-medium text-warning-foreground")}>
                      {n.text}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="panel p-3.5">
      <p className="label-caps">{label}</p>
      <p className="numeric mt-1.5 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Chips<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
