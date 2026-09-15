import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { useCustomerHistory, useCustomers, useMyShop } from "@/lib/shop";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Navalha" },
      {
        name: "description",
        content: "Clientes da barbearia com telefone, último atendimento e total de atendimentos.",
      },
      { property: "og:title", content: "Clientes — Navalha" },
      { property: "og:description", content: "Base de clientes da sua barbearia." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { data: shop } = useMyShop();
  const { data: customers } = useCustomers(shop?.id);
  const { data: history } = useCustomerHistory(shop?.id);
  const [term, setTerm] = useState("");

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; last: string | null }>();
    for (const row of history ?? []) {
      const current = map.get(row.customer_id) ?? { count: 0, last: null };
      const done = row.status !== "cancelled";
      map.set(row.customer_id, {
        count: current.count + (done ? 1 : 0),
        last: current.last ?? (done && new Date(row.starts_at) <= new Date() ? row.starts_at : null),
      });
    }
    return map;
  }, [history]);

  const list = (customers ?? []).filter((c) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <AppShell title="Clientes" description={`${(customers ?? []).length} cadastrados`}>
      <Input
        className="h-11"
        placeholder="Buscar por nome ou telefone"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      <section className="mt-4 panel overflow-hidden">
        {list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado. Os clientes são cadastrados automaticamente no primeiro
            agendamento.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((c) => {
              const stat = stats.get(c.id);
              return (
                <li
                  key={c.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="numeric truncate text-xs text-muted-foreground">{c.phone}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="numeric text-sm font-medium">{stat?.count ?? 0} atendimentos</p>
                    <p className="numeric text-xs text-muted-foreground">
                      {stat?.last ? `Último em ${shortDate(new Date(stat.last))}` : "Sem histórico"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
