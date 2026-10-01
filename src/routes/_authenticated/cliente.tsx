import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarPlus, LogOut } from "lucide-react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { hhmm, money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cliente")({
  head: () => ({
    meta: [
      { title: "Meus agendamentos — Navalha" },
      { name: "description", content: "Veja seus horários marcados e faça um novo agendamento." },
      { property: "og:title", content: "Meus agendamentos — Navalha" },
      { property: "og:description", content: "Seus horários marcados nas barbearias." },
    ],
  }),
  component: () => (
    <RoleGate allow={["client"]}>
      <ClientPage />
    </RoleGate>
  ),
});

type MyAppointment = {
  id: string;
  starts_at: string;
  status: string;
  price_cents: number;
  services: { name: string } | null;
  barbers: { name: string } | null;
  barbershops: { name: string; slug: string } | null;
};

function useMyAppointments() {
  return useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      // RLS só devolve agendamentos feitos por esta conta.
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, status, price_cents, services(name), barbers(name), barbershops(name, slug)")
        .eq("booked_by" as never, u.user.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MyAppointment[];
    },
  });
}

function ClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: list, isLoading } = useMyAppointments();
  const now = new Date();
  const upcoming = (list ?? []).filter((a) => new Date(a.starts_at) >= now).reverse();
  const past = (list ?? []).filter((a) => new Date(a.starts_at) < now);
  const lastShop = (list ?? [])[0]?.barbershops?.slug;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <p className="font-display text-lg font-semibold tracking-tight">Navalha</p>
          <Button variant="ghost" className="h-10" onClick={signOut}>
            <LogOut className="size-4" aria-hidden /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-semibold">Meus agendamentos</h1>

        <NewBooking lastShop={lastShop} />

        <Section title="Próximos" items={upcoming} loading={isLoading} empty="Nenhum horário marcado." />
        {past.length > 0 && <Section title="Anteriores" items={past} />}
      </main>
    </div>
  );
}

function NewBooking({ lastShop }: { lastShop?: string | undefined }) {
  const [slug, setSlug] = useState("");
  const clean = slug.trim().replace(/^.*\/barbearia\//, "").replace(/\/$/, "");
  return (
    <section className="mt-5 panel p-4">
      <p className="text-sm font-medium">Novo agendamento</p>
      {lastShop ? (
        <Link to="/barbearia/$slug" params={{ slug: lastShop }} className="mt-3 block">
          <Button className="h-11 w-full">
            <CalendarPlus className="size-4" aria-hidden /> Novo agendamento
          </Button>
        </Link>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {lastShop ? "Ou agende em outra barbearia:" : "Informe o endereço da barbearia (enviado por ela):"}
      </p>
      <div className="mt-2 flex gap-2">
        <Input
          className="h-11"
          placeholder="nome-da-barbearia"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        {clean ? (
          <Link to="/barbearia/$slug" params={{ slug: clean }}>
            <Button variant="outline" className="h-11">Continuar</Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-11" disabled>Continuar</Button>
        )}
      </div>
    </section>
  );
}

function Section({
  title,
  items,
  loading,
  empty,
}: {
  title: string;
  items: MyAppointment[];
  loading?: boolean;
  empty?: string;
}) {
  return (
    <section className="mt-6">
      <p className="label-caps">{title}</p>
      <div className="mt-2 panel overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
                <span className="w-16">
                  <span className="numeric block text-sm font-semibold">{shortDate(new Date(a.starts_at))}</span>
                  <span className="numeric block text-xs text-muted-foreground">{hhmm(a.starts_at)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{a.services?.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.barbershops?.name} · {a.barbers?.name} · {money(a.price_cents)}
                  </span>
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
