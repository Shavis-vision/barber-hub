import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { maskPhone } from "@/lib/format";
import { useMyShop, useWorkingHours, type WorkingHour } from "@/lib/shop";

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Navalha" },
      {
        name: "description",
        content:
          "Dados da barbearia, endereço público de agendamento e horários de funcionamento por dia da semana.",
      },
      { property: "og:title", content: "Configurações — Navalha" },
      {
        property: "og:description",
        content: "Dados da barbearia e horários de funcionamento.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["owner"]}>
      <ConfigPage />
    </RoleGate>
  ),
});

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

type DayForm = { is_open: boolean; opens: string; closes: string; id: string | null };

function ConfigPage() {
  const queryClient = useQueryClient();
  const { data: shop } = useMyShop();
  const { data: hours } = useWorkingHours(shop?.id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [savingShop, setSavingShop] = useState(false);
  const [days, setDays] = useState<DayForm[]>([]);
  const [savingHours, setSavingHours] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);
  const [origin, setOrigin] = useState("");
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!shop) return;
    setName(shop.name);
    setPhone(shop.phone ?? "");
    setAddress(shop.address ?? "");
    setSlug(shop.slug);
  }, [shop]);

  const publicUrl = shop && origin ? `${origin}/barbearia/${shop.slug}` : "";

  useEffect(() => {
    if (!hours) return;
    // Horário padrão da barbearia: barber_id = null
    const shopHours = (hours as WorkingHour[]).filter((h) => h.barber_id === null);
    setDays(
      WEEKDAYS.map((_, weekday) => {
        const row = shopHours.find((h) => h.weekday === weekday);
        return {
          id: row?.id ?? null,
          is_open: row?.is_open ?? false,
          opens: (row?.opens ?? "09:00:00").slice(0, 5),
          closes: (row?.closes ?? "19:00:00").slice(0, 5),
        };
      }),
    );
  }, [hours]);

  async function saveShop() {
    if (!shop) return;
    setSavingShop(true);
    const { error } = await supabase
      .from("barbershops")
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq("id", shop.id);
    setSavingShop(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dados salvos.");
    queryClient.invalidateQueries({ queryKey: ["my-shop"] });
  }

  async function saveHours() {
    if (!shop) return;
    setSavingHours(true);
    try {
      for (const [weekday, day] of days.entries()) {
        const payload = {
          barbershop_id: shop.id,
          barber_id: null,
          weekday,
          opens: `${day.opens}:00`,
          closes: `${day.closes}:00`,
          is_open: day.is_open,
        };
        const { error } = day.id
          ? await supabase.from("working_hours").update(payload).eq("id", day.id)
          : await supabase.from("working_hours").insert(payload);
        if (error) throw error;
      }
      toast.success("Horários atualizados.");
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSavingHours(false);
    }
  }

  async function saveSlug() {
    if (!shop) return;
    const next = normalizeSlug(slug);
    if (next.length < 3) {
      setSlugError("O link precisa ter pelo menos 3 caracteres.");
      return;
    }
    setSlug(next);
    if (next === shop.slug) {
      toast.success("Link mantido.");
      return;
    }
    setSavingSlug(true);
    const { error } = await supabase.from("barbershops").update({ slug: next }).eq("id", shop.id);
    setSavingSlug(false);
    if (error) {
      if (error.code === "23505") setSlugError("Este link já está em uso. Escolha outro.");
      else toast.error(error.message);
      return;
    }
    toast.success("Link atualizado. O link antigo deixou de funcionar.");
    queryClient.invalidateQueries({ queryKey: ["my-shop"] });
  }

  function downloadQr() {
    const canvas = qrRef.current;
    if (!canvas || !shop) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qrcode-${shop.slug}.png`;
    a.click();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  function updateDay(index: number, patch: Partial<DayForm>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  return (
    <AppShell title="Configurações" description="Dados da barbearia e horários de funcionamento">
      <section className="panel p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Barbearia</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="shop-name">Nome</Label>
            <Input
              id="shop-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-phone">Telefone</Label>
            <Input
              id="shop-phone"
              className="h-11"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="shop-address">Endereço</Label>
            <Input
              id="shop-address"
              className="h-11"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>
        </div>
        <Button className="mt-4 h-11" onClick={saveShop} disabled={savingShop || !shop}>
          {savingShop ? "Salvando…" : "Salvar"}
        </Button>
      </section>

      <section className="mt-6 panel p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Página pública de agendamento</h2>
        {shop && (
          <p className="mt-1 text-sm text-muted-foreground">
            Link atual:{" "}
            <a className="text-primary break-all" href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl || `/barbearia/${shop.slug}`}
            </a>
          </p>
        )}
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="shop-slug">Final do link</Label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">/barbearia/</span>
            <Input
              id="shop-slug"
              className="h-11 min-w-0 flex-1 sm:max-w-xs"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugError(null);
              }}
              aria-invalid={!!slugError}
            />
            <Button className="h-11" onClick={saveSlug} disabled={savingSlug || !shop}>
              {savingSlug ? "Salvando…" : "Salvar link"}
            </Button>
          </div>
          {slug && normalizeSlug(slug) !== slug && (
            <p className="text-xs text-muted-foreground">Será salvo como: {normalizeSlug(slug) || "—"}</p>
          )}
          {slugError && <p className="text-sm text-destructive">{slugError}</p>}
          <p className="text-xs text-muted-foreground">
            Ao alterar, o link antigo deixa de funcionar.
          </p>
        </div>
        {shop && publicUrl && (
          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="rounded-md border border-border bg-background p-3">
              <QRCodeCanvas
                ref={qrRef}
                value={publicUrl}
                size={160}
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11" onClick={downloadQr}>
                <Download className="size-4" /> Baixar QR code
              </Button>
              <Button variant="outline" className="h-11" onClick={copyLink}>
                <Copy className="size-4" /> Copiar link
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 panel">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Horário de funcionamento</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Define os horários oferecidos na página pública.
          </p>
        </header>
        <ul className="divide-y divide-border">
          {days.map((day, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-40 flex-1 items-center gap-3">
                <Switch
                  id={`day-${index}`}
                  checked={day.is_open}
                  onCheckedChange={(checked) => updateDay(index, { is_open: checked })}
                />
                <Label htmlFor={`day-${index}`} className="text-sm font-medium">
                  {WEEKDAYS[index]}
                </Label>
              </div>
              {day.is_open ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    className="numeric h-11 w-28"
                    value={day.opens}
                    onChange={(e) => updateDay(index, { opens: e.target.value })}
                    aria-label={`Abertura ${WEEKDAYS[index]}`}
                  />
                  <span className="text-sm text-muted-foreground">às</span>
                  <Input
                    type="time"
                    className="numeric h-11 w-28"
                    value={day.closes}
                    onChange={(e) => updateDay(index, { closes: e.target.value })}
                    aria-label={`Fechamento ${WEEKDAYS[index]}`}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fechado</span>
              )}
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-4 py-3">
          <Button className="h-11" onClick={saveHours} disabled={savingHours || !shop}>
            {savingHours ? "Salvando…" : "Salvar horários"}
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
