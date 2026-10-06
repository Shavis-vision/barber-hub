import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarX, Check, Clock, Loader2, MapPin, Scissors, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchSlots, groupSlots, useAvailableSlots } from "@/lib/booking";
import { addDays, fromDateKey, hhmm, longDate, maskPhone, money, shortDate, toDateKey, weekdayShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/barbearia/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Agendar horário — ${params.slug} | Navalha` },
      { name: "description", content: "Escolha serviço, barbeiro e horário disponível e agende em poucos passos." },
      { property: "og:title", content: `Agendar horário — ${params.slug}` },
      { property: "og:description", content: "Agende seu horário online em poucos passos." },
    ],
  }),
  component: PublicBooking,
});

type Shop = { id: string; name: string; slug: string; address: string | null };
type Svc = { id: string; name: string; description: string | null; price_cents: number; duration_minutes: number };
type Brb = { id: string; name: string };

function usePublicShop(slug: string) {
  return useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => {
      const { data: shop, error } = await supabase
        .from("barbershops")
        .select("id, name, slug, address")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!shop) return null;
      const [svc, brb, link, wh] = await Promise.all([
        supabase.from("services").select("id, name, description, price_cents, duration_minutes").eq("barbershop_id", shop.id).eq("active", true).order("created_at"),
        supabase.from("barbers").select("id, name").eq("barbershop_id", shop.id).eq("active", true).order("name"),
        supabase.from("barber_services").select("barber_id, service_id").eq("barbershop_id", shop.id),
        supabase.from("working_hours").select("barber_id, weekday, is_open").eq("barbershop_id", shop.id),
      ]);
      return {
        shop: shop as Shop,
        services: (svc.data ?? []) as Svc[],
        barbers: (brb.data ?? []) as Brb[],
        links: (link.data ?? []) as { barber_id: string; service_id: string }[],
        hours: (wh.data ?? []) as { barber_id: string | null; weekday: number; is_open: boolean }[],
      };
    },
  });
}

const STEPS = ["Serviço", "Barbeiro", "Data", "Horário", "Seus dados"];

function PublicBooking() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = usePublicShop(slug);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null | undefined>(undefined);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ starts_at: string; barber_id: string } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [done]);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);
  const slots = useAvailableSlots(slug, serviceId, barberId ?? null, dateKey);
  const grouped = groupSlots(slots.data ?? []);

  const emptyReason = (() => {
    if (!data || !dateKey || slots.isLoading || slots.isError || grouped.length > 0) return null;
    const wd = fromDateKey(dateKey).getDay();
    const shopDay = data.hours.find((h) => h.barber_id === null && h.weekday === wd);
    if (!shopDay || !shopDay.is_open) return "closed" as const;
    if (barberId) {
      const own = data.hours.filter((h) => h.barber_id === barberId);
      const day = own.find((h) => h.weekday === wd);
      if (own.length > 0 && (!day || !day.is_open)) return "barber_off" as const;
    }
    return "full" as const;
  })();

  const nextFree = useQuery({
    queryKey: ["next-free", slug, serviceId, barberId ?? null, dateKey],
    enabled: emptyReason === "full",
    staleTime: 15_000,
    queryFn: async () => {
      const start = fromDateKey(dateKey!);
      for (let i = 1; i <= 14; i++) {
        const key = toDateKey(addDays(start, i));
        const found = await fetchSlots(slug, serviceId!, barberId ?? null, key);
        if (found.length > 0) return key;
      }
      return null;
    },
  });

  const step = !serviceId ? 0 : barberId === undefined ? 1 : !dateKey ? 2 : !slot ? 3 : 4;

  if (isLoading) return <Shell><LoadingState /></Shell>;
  if (!data) {
    return (
      <Shell>
        <div className="panel p-8 text-center">
          <h1 className="text-xl font-semibold">Barbearia não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Confira o endereço enviado pela barbearia.</p>
        </div>
      </Shell>
    );
  }

  const service = data.services.find((s) => s.id === serviceId);
  const barbersForService = data.barbers.filter((b) =>
    data.links.some((l) => l.barber_id === b.id && l.service_id === serviceId),
  );
  const barberName = (id?: string | null) => data.barbers.find((b) => b.id === id)?.name ?? "Qualquer barbeiro";

  async function confirm() {
    if (!serviceId || !slot) return;
    setSaving(true);
    const { data: result, error } = await supabase.rpc("book_appointment", {
      p_slug: slug,
      p_service: serviceId,
      p_barber: (barberId ?? null) as unknown as string,
      p_slot: slot,
      p_name: name,
      p_phone: phone,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      setSlot(null);
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    setDone(result as { starts_at: string; barber_id: string });
  }

  const periods = [
    { label: "Manhã", items: grouped.filter((g) => new Date(g.slotAt).getHours() < 12) },
    { label: "Tarde", items: grouped.filter((g) => { const h = new Date(g.slotAt).getHours(); return h >= 12 && h < 18; }) },
    { label: "Noite", items: grouped.filter((g) => new Date(g.slotAt).getHours() >= 18) },
  ].filter((p) => p.items.length > 0);

  if (done) {
    return (
      <Shell shop={data.shop}>
        <div className="panel overflow-hidden">
          <div className="p-6 text-center sm:p-8">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-6" aria-hidden />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Agendamento confirmado</h1>
            <p className="mt-1 text-sm text-muted-foreground">Te esperamos em {data.shop.name}.</p>
          </div>
          <dl className="divide-y divide-border border-t border-border text-sm">
            <SummaryRow label="Serviço" value={service?.name} />
            <SummaryRow label="Barbeiro" value={barberName(done.barber_id)} />
            <SummaryRow label="Data" value={longDate(new Date(done.starts_at))} />
            <SummaryRow label="Horário" value={hhmm(done.starts_at)} />
            {service && <SummaryRow label="Valor" value={money(service.price_cents)} />}
          </dl>
          <div className="border-t border-border p-4">
            <Link to={signedIn ? "/cliente" : "/auth"} className="block">
              <Button variant="outline" className="h-12 w-full">
                {signedIn ? "Ver meus agendamentos" : "Entrar para ver meus agendamentos"}
              </Button>
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const resetService = () => { setServiceId(null); setBarberId(undefined); setDateKey(null); setSlot(null); };

  return (
    <Shell shop={data.shop} servicesCount={data.services.length}>
      <nav aria-label="Etapas" className="sticky top-0 z-10 -mx-4 mb-2 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <ol className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <span className={cn("block h-1 rounded-full transition-colors", i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-border")} />
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Etapa <span className="numeric font-medium text-foreground">{step + 1}</span> de 5 · <span className="font-medium text-foreground">{STEPS[step]}</span>
        </p>
      </nav>

      <Block n={1} title="Escolha o serviço" done={!!serviceId} value={service ? `${service.name} · ${money(service.price_cents)}` : undefined} onEdit={serviceId ? resetService : undefined}>
        {!serviceId && (
          data.services.length === 0 ? (
            <EmptyNote>Esta barbearia ainda não tem serviços disponíveis.</EmptyNote>
          ) : (
            <div className="grid gap-2.5">
              {data.services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServiceId(s.id)}
                  className="group flex min-h-16 w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.name}</span>
                    {s.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{s.description}</span>}
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden /> <span className="numeric">{s.duration_minutes} min</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="numeric text-base font-semibold">{money(s.price_cents)}</span>
                    <span className="text-xs font-medium text-primary">Selecionar</span>
                  </span>
                </button>
              ))}
            </div>
          )
        )}
      </Block>

      {serviceId && (
        <Block n={2} title="Escolha o barbeiro" done={barberId !== undefined} value={barberId === undefined ? undefined : barberName(barberId)} onEdit={barberId !== undefined ? () => { setBarberId(undefined); setSlot(null); } : undefined}>
          {barberId === undefined && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Choice onClick={() => setBarberId(null)} avatar={<Users className="size-4" aria-hidden />}>
                <span className="font-medium">Qualquer barbeiro</span>
                <span className="block text-xs text-muted-foreground">Mais horários disponíveis</span>
              </Choice>
              {barbersForService.map((b) => (
                <Choice key={b.id} onClick={() => setBarberId(b.id)} avatar={<span className="text-sm font-semibold">{initials(b.name)}</span>}>
                  <span className="font-medium">{b.name}</span>
                </Choice>
              ))}
            </div>
          )}
        </Block>
      )}

      {serviceId && barberId !== undefined && (
        <Block n={3} title="Escolha a data" done={!!dateKey} value={dateKey ? `${weekdayShort(fromDateKey(dateKey).getDay())}, ${shortDate(fromDateKey(dateKey))}` : undefined}>
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {days.map((d, i) => {
              const key = toDateKey(d);
              const active = key === dateKey;
              return (
                <button
                  key={key}
                  onClick={() => { setDateKey(key); setSlot(null); }}
                  aria-pressed={active}
                  className={cn(
                    "flex h-[4.5rem] w-16 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary",
                  )}
                >
                  <span className={cn("text-[11px] uppercase tracking-wide", active ? "opacity-90" : "text-muted-foreground")}>
                    {i === 0 ? "Hoje" : weekdayShort(d.getDay())}
                  </span>
                  <span className="numeric text-lg font-semibold leading-none">{shortDate(d).split("/")[0]}</span>
                </button>
              );
            })}
          </div>
        </Block>
      )}

      {dateKey && (
        <Block n={4} title="Escolha o horário" done={!!slot} value={slot ? hhmm(slot) : undefined}>
          {slots.isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Buscando horários" aria-busy>
              {Array.from({ length: 10 }).map((_, i) => <span key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : slots.isError ? (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Não foi possível carregar os horários. {(slots.error as Error).message}</span>
            </div>
          ) : grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center">
              <CalendarX className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-medium">
                {emptyReason === "closed"
                  ? "Barbearia fechada neste dia."
                  : emptyReason === "barber_off"
                    ? "Este barbeiro não atende neste dia."
                    : "Nenhum horário disponível para este dia."}
              </p>
              {emptyReason === "full" && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  {nextFree.isLoading ? (
                    <span className="text-sm text-muted-foreground">Procurando o próximo dia livre…</span>
                  ) : nextFree.data ? (
                    <Button className="h-11" onClick={() => { setDateKey(nextFree.data!); setSlot(null); }}>
                      Próximo dia livre: {weekdayShort(fromDateKey(nextFree.data).getDay())} {shortDate(fromDateKey(nextFree.data))}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sem horários livres nos próximos 14 dias.</span>
                  )}
                  {barberId && barbersForService.length > 1 && (
                    <Button variant="outline" className="h-11" onClick={() => { setBarberId(undefined); setSlot(null); }}>
                      Escolher outro barbeiro
                    </Button>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Ou escolha outra data acima.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {periods.map((p) => (
                <div key={p.label}>
                  <p className="label-caps mb-2">{p.label}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {p.items.map((g) => {
                      const active = slot === g.slotAt;
                      return (
                        <button
                          key={g.slotAt}
                          onClick={() => setSlot(g.slotAt)}
                          aria-pressed={active}
                          className={cn(
                            "numeric h-12 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary",
                          )}
                        >
                          {hhmm(g.slotAt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Block>
      )}

      {slot && (
        <Block n={5} title="Seus dados">
          <div className="mb-4 rounded-xl bg-muted/60 p-4 text-sm">
            <p className="font-medium">{service?.name} · {barberName(barberId)}</p>
            <p className="numeric mt-0.5 text-muted-foreground">
              {longDate(fromDateKey(dateKey!))} às {hhmm(slot)}{service ? ` · ${money(service.price_cents)}` : ""}
            </p>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Nome</span>
              <Input className="h-12 text-base" placeholder="Seu nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Telefone (WhatsApp)</span>
              <Input className="h-12 text-base" placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
            </label>
            <Button className="mt-1 h-12 text-base" disabled={saving || !name.trim() || phone.replace(/\D/g, "").length < 10} onClick={confirm}>
              {saving ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Confirmando…</> : "Confirmar agendamento"}
            </Button>
          </div>
        </Block>
      )}
    </Shell>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function Shell({ shop, servicesCount, children }: { shop?: Shop; servicesCount?: number; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-xl px-4 py-6 sm:py-8">
          {shop ? (
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
                {initials(shop.name)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{shop.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {shop.address && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{shop.address}</span></span>}
                  {!!servicesCount && <span className="inline-flex items-center gap-1"><Scissors className="size-3.5" aria-hidden />{servicesCount} {servicesCount === 1 ? "serviço" : "serviços"}</span>}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-lg font-semibold">Navalha</p>
          )}
          {shop && <p className="mt-4 text-sm text-muted-foreground">Agende seu horário online em poucos passos.</p>}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-2">{children}</main>
      <footer className="pb-8 text-center text-xs text-muted-foreground">Agendamento por Navalha</footer>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-4 space-y-3" aria-busy aria-label="Carregando">
      <span className="block h-5 w-40 animate-pulse rounded bg-muted" />
      {Array.from({ length: 3 }).map((_, i) => <span key={i} className="block h-20 animate-pulse rounded-xl bg-muted" />)}
    </div>
  );
}

function Block({ n, title, done, value, onEdit, children }: { n: number; title: string; done?: boolean; value?: string | undefined; onEdit?: (() => void) | undefined; children?: React.ReactNode }) {
  return (
    <section className="mt-3 panel p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground")}>
          {done ? <Check className="size-3.5" aria-hidden /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cn("text-sm", done ? "text-muted-foreground" : "font-semibold")}>{title}</h2>
          {value && <p className="truncate text-sm font-medium">{value}</p>}
        </div>
        {onEdit && (
          <button className="h-9 shrink-0 rounded-md px-2 text-sm font-medium text-primary hover:bg-muted" onClick={onEdit}>Alterar</button>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Choice({ onClick, avatar, children }: { onClick: () => void; avatar: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">{avatar}</span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="numeric truncate text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{children}</p>;
}
