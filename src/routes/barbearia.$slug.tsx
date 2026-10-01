import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { groupSlots, useAvailableSlots } from "@/lib/booking";
import { addDays, hhmm, longDate, maskPhone, money, shortDate, toDateKey, weekdayShort } from "@/lib/format";
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
      const [svc, brb, link] = await Promise.all([
        supabase.from("services").select("id, name, description, price_cents, duration_minutes").eq("barbershop_id", shop.id).eq("active", true).order("created_at"),
        supabase.from("barbers").select("id, name").eq("barbershop_id", shop.id).eq("active", true).order("name"),
        supabase.from("barber_services").select("barber_id, service_id").eq("barbershop_id", shop.id),
      ]);
      return {
        shop: shop as Shop,
        services: (svc.data ?? []) as Svc[],
        barbers: (brb.data ?? []) as Brb[],
        links: (link.data ?? []) as { barber_id: string; service_id: string }[],
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

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);
  const slots = useAvailableSlots(slug, serviceId, barberId ?? null, dateKey);
  const grouped = groupSlots(slots.data ?? []);

  const step = !serviceId ? 0 : barberId === undefined ? 1 : !dateKey ? 2 : !slot ? 3 : 4;

  if (isLoading) return <Shell><p className="text-sm text-muted-foreground">Carregando…</p></Shell>;
  if (!data) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Barbearia não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confira o endereço enviado pela barbearia.</p>
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

  if (done) {
    return (
      <Shell title={data.shop.name}>
        <div className="panel p-6 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold">Agendamento confirmado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {service?.name} com {barberName(done.barber_id)}
          </p>
          <p className="numeric mt-1 text-sm font-medium">
            {longDate(new Date(done.starts_at))} às {hhmm(done.starts_at)}
          </p>
          <Link to="/cliente" className="mt-6 block">
            <Button variant="outline" className="h-11 w-full">Ver meus agendamentos</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={data.shop.name} subtitle={data.shop.address}>
      <ol className="mb-5 flex gap-1.5" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={cn("block h-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
            <span className={cn("mt-1.5 hidden text-[11px] sm:block", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>
              {s}
            </span>
          </li>
        ))}
      </ol>
      <p className="label-caps">Etapa {step + 1} de 5 · {STEPS[step]}</p>

      {/* 1. Serviço */}
      <Block title="Serviço" value={service?.name} onEdit={serviceId ? () => { setServiceId(null); setBarberId(undefined); setDateKey(null); setSlot(null); } : undefined}>
        {!serviceId && (
          <div className="grid gap-2">
            {data.services.map((s) => (
              <Choice key={s.id} onClick={() => setServiceId(s.id)}>
                <span className="font-medium">{s.name}</span>
                <span className="numeric text-sm text-muted-foreground">{s.duration_minutes} min · {money(s.price_cents)}</span>
              </Choice>
            ))}
          </div>
        )}
      </Block>

      {/* 2. Barbeiro */}
      {serviceId && (
        <Block title="Barbeiro" value={barberId === undefined ? undefined : barberName(barberId)} onEdit={barberId !== undefined ? () => { setBarberId(undefined); setSlot(null); } : undefined}>
          {barberId === undefined && (
            <div className="grid gap-2">
              <Choice onClick={() => setBarberId(null)}><span className="font-medium">Qualquer barbeiro disponível</span></Choice>
              {barbersForService.map((b) => (
                <Choice key={b.id} onClick={() => setBarberId(b.id)}><span className="font-medium">{b.name}</span></Choice>
              ))}
            </div>
          )}
        </Block>
      )}

      {/* 3. Data */}
      {serviceId && barberId !== undefined && (
        <Block title="Data">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {days.map((d) => {
              const key = toDateKey(d);
              const active = key === dateKey;
              return (
                <button
                  key={key}
                  onClick={() => { setDateKey(key); setSlot(null); }}
                  aria-pressed={active}
                  className={cn(
                    "flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-sm",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  <span className="text-[11px] opacity-80">{weekdayShort(d.getDay())}</span>
                  <span className="numeric font-semibold">{shortDate(d).split("/")[0]}</span>
                </button>
              );
            })}
          </div>
        </Block>
      )}

      {/* 4. Horário */}
      {dateKey && (
        <Block title="Horário">
          {slots.isLoading ? (
            <p className="text-sm text-muted-foreground">Buscando horários…</p>
          ) : slots.isError ? (
            <p className="text-sm text-destructive">
              Erro ao buscar horários: {(slots.error as Error).message}
            </p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há horários disponíveis para esta data.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {grouped.map((g) => (
                <button
                  key={g.slotAt}
                  onClick={() => setSlot(g.slotAt)}
                  aria-pressed={slot === g.slotAt}
                  className={cn(
                    "numeric h-11 rounded-lg border text-sm font-medium",
                    slot === g.slotAt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  {hhmm(g.slotAt)}
                </button>
              ))}
            </div>
          )}
        </Block>
      )}

      {/* 5. Dados */}
      {slot && (
        <Block title="Seus dados">
          <div className="grid gap-2">
            <Input className="h-11" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="h-11" placeholder="Telefone (WhatsApp)" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
            <Button className="mt-2 h-12" disabled={saving || !name.trim() || phone.replace(/\D/g, "").length < 10} onClick={confirm}>
              {saving ? "Confirmando…" : "Confirmar agendamento"}
            </Button>
          </div>
        </Block>
      )}
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title?: string; subtitle?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-xl px-4 py-4">
          <p className="truncate text-lg font-semibold">{title ?? "Navalha"}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
    </div>
  );
}

function Block({ title, value, onEdit, children }: { title: string; value?: string | undefined; onEdit?: (() => void) | undefined; children?: React.ReactNode }) {
  return (
    <section className="mt-4 panel p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        {value && (
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate text-muted-foreground">{value}</span>
            {onEdit && <button className="shrink-0 text-primary underline-offset-2 hover:underline" onClick={onEdit}>Alterar</button>}
          </span>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

function Choice({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary">
      {children}
    </button>
  );
}
