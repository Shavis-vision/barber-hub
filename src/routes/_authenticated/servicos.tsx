import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useServices, type Service } from "@/lib/shop";
import { money, parseMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Navalha" },
      {
        name: "description",
        content: "Cadastro de serviços da barbearia com preço, duração e status.",
      },
      { property: "og:title", content: "Serviços — Navalha" },
      { property: "og:description", content: "Serviços oferecidos pela sua barbearia." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { data: shop } = useMyShop();
  const { data: services, isLoading } = useServices(shop?.id);
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      title="Serviços"
      description="Nome, preço, duração e status"
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
            <span className="hidden sm:inline">Novo serviço</span>
          </Button>
        )
      }
    >
      <section className="panel overflow-hidden">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (services ?? []).length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum serviço cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(services ?? []).map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setEditing(s);
                    setOpen(true);
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="numeric block truncate text-xs text-muted-foreground">
                      {money(s.price_cents)} · {s.duration_minutes} min
                      {!s.active && " · inativo"}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">Editar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shop && (
        <ServiceDialog
          shopId={shop.id}
          service={editing}
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

function ServiceDialog({
  shopId,
  service,
  open,
  onOpenChange,
}: {
  shopId: string;
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [duration, setDuration] = useState(30);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  const currentKey = service?.id ?? "new";
  if (open && key !== currentKey) {
    setKey(currentKey);
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setPrice(service?.price_cents ?? 0);
    setDuration(service?.duration_minutes ?? 30);
    setActive(service?.active ?? true);
  }
  if (!open && key !== null) setKey(null);

  async function save() {
    if (!name.trim()) {
      toast.error("Informe o nome do serviço.");
      return;
    }
    setSaving(true);
    const payload = {
      barbershop_id: shopId,
      name: name.trim(),
      description: description.trim() || null,
      price_cents: price,
      duration_minutes: Math.max(5, duration),
      active,
    };
    const { error } = service
      ? await supabase.from("services").update(payload).eq("id", service.id)
      : await supabase.from("services").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(service ? "Serviço salvo." : "Serviço criado.");
    queryClient.invalidateQueries({ queryKey: ["services"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>
            A duração define os horários oferecidos no agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Nome</Label>
            <Input
              id="svc-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Corte"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-desc">Descrição</Label>
            <Textarea
              id="svc-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="svc-price">Preço</Label>
              <Input
                id="svc-price"
                className="h-11"
                inputMode="numeric"
                value={money(price)}
                onChange={(e) => setPrice(parseMoney(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-duration">Duração (min)</Label>
              <Input
                id="svc-duration"
                className="h-11"
                inputMode="numeric"
                value={String(duration)}
                onChange={(e) => setDuration(Number(e.target.value.replace(/\D/g, "")) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
            <Label htmlFor="svc-active" className="text-sm font-normal">
              Serviço ativo
            </Label>
            <Switch id="svc-active" checked={active} onCheckedChange={setActive} />
          </div>

          <Button onClick={save} disabled={saving} className="h-12 w-full">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
