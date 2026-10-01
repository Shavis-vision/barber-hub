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

/** Aceita link completo, "meu-slug" ou nome com acento/maiúscula e devolve um slug válido. */
function toSlug(input: string) {
  return input
    .trim()
    .replace(/^.*\/barbearia\//, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ShopHit = { name: string; slug: string; address: string | null };

function useShopSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ["shop-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const safe = q.replace(/[%_,()]/g, " ");
      const { data, error } = await supabase
        .from("barbershops")
        .select("name, slug, address")
        .or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`)
        .order("name")
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ShopHit[];
    },
  });
}

function NewBooking({ lastShop }: { lastShop?: string | undefined }) {
  const [term, setTerm] = useState("");
  const direct = toSlug(term);
  const isLink = term.includes("/barbearia/");
  const search = useShopSearch(isLink ? direct : term);
  const hits = search.data ?? [];
  const typed = term.trim().length >= 2;

  return (
    <section className="mt-5 panel p-4">
      <p className="text-sm font-medium">Novo agendamento</p>
      {lastShop ? (
        <Link to="/barbearia/$slug" params={{ slug: lastShop }} className="mt-3 block">
          <Button className="h-11 w-full">
            <CalendarPlus className="size-4" aria-hidden /> Agendar de novo na última barbearia
          </Button>
        </Link>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {lastShop ? "Ou procure outra barbearia:" : "Procure a barbearia pelo nome ou cole o link enviado por ela:"}
      </p>
      <Input
        className="mt-2 h-11"
        placeholder="Nome da barbearia"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      {typed && (
        <div className="mt-2 grid gap-2">
          {search.isLoading ? (
            <p className="text-xs text-muted-foreground">Buscando…</p>
          ) : hits.length > 0 ? (
            hits.map((s) => (
              <Link key={s.slug} to="/barbearia/$slug" params={{ slug: s.slug }}>
                <span className="flex min-h-12 w-full flex-col justify-center rounded-xl border border-border bg-card px-4 py-2 text-left transition-colors hover:border-primary">
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.address && <span className="truncate text-xs text-muted-foreground">{s.address}</span>}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma barbearia encontrada com esse nome.
              {isLink && direct ? " Tentando abrir o link informado:" : ""}
            </p>
          )}
          {hits.length === 0 && !search.isLoading && isLink && direct && (
            <Link to="/barbearia/$slug" params={{ slug: direct }}>
              <Button variant="outline" className="h-11 w-full">Abrir link</Button>
            </Link>
          )}
        </div>
      )}
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
