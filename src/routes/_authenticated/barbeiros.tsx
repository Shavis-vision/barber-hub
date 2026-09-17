import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { useBarberServices, useBarbers, useMyShop, useServices, type Barber } from "@/lib/shop";
import { maskPhone } from "@/lib/format";

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
  component: BarbersPage,
});

function BarbersPage() {
  const { data: shop } = useMyShop();
  const { data: barbers, isLoading } = useBarbers(shop?.id);
  const { data: services } = useServices(shop?.id);
  const { data: links } = useBarberServices(shop?.id);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [open, setOpen] = useState(false);

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

          <Button onClick={save} disabled={saving} className="h-12 w-full">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
