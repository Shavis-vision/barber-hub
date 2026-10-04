import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/role-gate";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  useAppointmentsRange,
  useBarberServices,
  useBarbers,
  useMyShop,
  useServices,
  type Barber,
} from "@/lib/shop";
import { addDays, maskPhone, money, startOfWeek } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/barbeiros")({
  head: () => ({
    meta: [
      { title: "Barbeiros — Navalha" },
      {
        name: "description",
        content: "Equipe da barbearia: dados de contato, serviços realizados e status.",
      },
      { property: "og:title", content: "Barbeiros — Navalha" },
      { property: "og:description", content: "Equipe da sua barbearia." },
    ],
  }),
  component: () => (
    <RoleGate allow={["owner"]}>
      <BarbersPage />
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

function BarbersPage() {
  const { data: shop } = useMyShop();
  const { data: barbers, isLoading } = useBarbers(shop?.id);
  const { data: services } = useServices(shop?.id);
  const { data: links } = useBarberServices(shop?.id);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("day");

  const { from: pFrom, to: pTo } = useMemo(() => periodRange(period), [period]);
  const { data: periodAppointments } = useAppointmentsRange(shop?.id, pFrom, pTo);

  // Resultado por barbeiro no período escolhido (só atendimentos concluídos geram valor).
  const results = (() => {
    const rows = new Map<
      string,
      { id: string; name: string; active: boolean; count: number; cents: number; noShow: number; cancelled: number }
    >();
    for (const b of barbers ?? []) {
      rows.set(b.id, { id: b.id, name: b.name, active: b.active, count: 0, cents: 0, noShow: 0, cancelled: 0 });
    }
    for (const a of periodAppointments ?? []) {
      const row =
        rows.get(a.barber_id) ??
        { id: a.barber_id, name: a.barbers?.name ?? "Barbeiro removido", active: false, count: 0, cents: 0, noShow: 0, cancelled: 0 };
      if (a.status === "completed") {
        row.count += 1;
        row.cents += a.price_cents;
      } else if (a.status === "no_show") {
        row.noShow += 1;
      } else if (a.status === "cancelled") {
        row.cancelled += 1;
      }
      rows.set(a.barber_id, row);
    }
    return [...rows.values()]
      .filter((r) => r.active || r.count > 0 || r.noShow > 0 || r.cancelled > 0)
      .sort((x, y) => y.cents - x.cents || y.count - x.count || x.name.localeCompare(y.name));
  })();
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);
  const totalCents = results.reduce((sum, r) => sum + r.cents, 0);

  return (
    <AppShell
      title="Barbeiros"
      description="Equipe e serviços realizados"
      action={
        shop && (
          <Button
            className="h-11 px-4"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Novo barbeiro</span>
          </Button>
        )
      }
    >
      <section className="panel overflow-hidden">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (barbers ?? []).length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum barbeiro cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(barbers ?? []).map((b) => {
              const count = (links ?? []).filter((l) => l.barber_id === b.id).length;
              return (
                <li key={b.id}>
                  <button
                    onClick={() => {
                      setEditing(b);
                      setOpen(true);
                    }}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{b.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {b.phone ?? "Sem telefone"} · {count} serviços
                        {!b.active && " · inativo"}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">Editar</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Resultado por barbeiro</h2>
          <div className="flex gap-2" role="group" aria-label="Período do resultado">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={period === key ? "default" : "outline"}
                onClick={() => setPeriod(key)}
              >
                {PERIOD_LABEL[key]}
              </Button>
            ))}
          </div>
        </header>
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum barbeiro cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {r.name}
                    {!r.active && <span className="text-xs text-muted-foreground"> (inativo)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.count} {r.count === 1 ? "cliente atendido" : "clientes atendidos"}
                    {r.noShow > 0 && ` · ${r.noShow} ${r.noShow === 1 ? "falta" : "faltas"}`}
                    {r.cancelled > 0 && ` · ${r.cancelled} ${r.cancelled === 1 ? "cancelado" : "cancelados"}`}
                  </span>
                </span>
                <span className="numeric text-base font-semibold">{money(r.cents)}</span>
              </li>
            ))}
          </ul>
        )}
        <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>Conta somente atendimentos marcados como concluídos.</span>
          <span className="numeric">
            Total: {totalCount} · {money(totalCents)}
          </span>
        </footer>
      </section>

      <p className="mt-4 text-sm text-muted-foreground">
        Os horários de funcionamento usados na agenda ficam em Configurações.
      </p>

      {shop && (
        <BarberDialog
          shopId={shop.id}
          barber={editing}
          services={(services ?? []).map((s) => ({ id: s.id, name: s.name }))}
          selectedServiceIds={(links ?? [])
            .filter((l) => l.barber_id === editing?.id)
            .map((l) => l.service_id)}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        />
      )}
    </AppShell>
  );
}

function BarberDialog({
  shopId,
  barber,
  services,
  selectedServiceIds,
  open,
  onOpenChange,
}: {
  shopId: string;
  barber: Barber | null;
  services: { id: string; name: string }[];
  selectedServiceIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  const currentKey = barber?.id ?? "new";
  if (open && key !== currentKey) {
    setKey(currentKey);
    setName(barber?.name ?? "");
    setPhone(barber?.phone ?? "");
    setActive(barber?.active ?? true);
    setChosen(barber ? selectedServiceIds : services.map((s) => s.id));
  }
  if (!open && key !== null) setKey(null);

  function toggle(id: string) {
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Informe o nome do barbeiro.");
      return;
    }
    setSaving(true);
    try {
      let barberId = barber?.id;
      const payload = {
        barbershop_id: shopId,
        name: name.trim(),
        phone: phone.trim() || null,
        active,
      };

      if (barberId) {
        const { error } = await supabase.from("barbers").update(payload).eq("id", barberId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("barbers").insert(payload).select("id").single();
        if (error) throw error;
        barberId = (data as { id: string }).id;
      }

      const { error: delError } = await supabase
        .from("barber_services")
        .delete()
        .eq("barber_id", barberId!);
      if (delError) throw delError;

      if (chosen.length) {
        const { error: insError } = await supabase.from("barber_services").insert(
          chosen.map((serviceId) => ({
            barbershop_id: shopId,
            barber_id: barberId!,
            service_id: serviceId,
          })),
        );
        if (insError) throw insError;
      }

      toast.success(barber ? "Barbeiro salvo." : "Barbeiro criado.");
      queryClient.invalidateQueries({ queryKey: ["barbers"] });
      queryClient.invalidateQueries({ queryKey: ["barber-services"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{barber ? "Editar barbeiro" : "Novo barbeiro"}</DialogTitle>
          <DialogDescription>
            Só os serviços marcados aparecem para este barbeiro no agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="barber-name">Nome</Label>
            <Input
              id="barber-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do barbeiro"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="barber-phone">Telefone</Label>
            <Input
              id="barber-phone"
              className="h-11"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label>Serviços realizados</Label>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cadastre serviços primeiro.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {services.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 px-3.5 py-3 text-sm"
                  >
                    <Checkbox checked={chosen.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
            <Label htmlFor="barber-active" className="text-sm font-normal">
              Barbeiro ativo
            </Label>
            <Switch id="barber-active" checked={active} onCheckedChange={setActive} />
          </div>

          {barber && <InviteSection shopId={shopId} barber={barber} />}

          <Button onClick={save} disabled={saving} className="h-12 w-full">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
