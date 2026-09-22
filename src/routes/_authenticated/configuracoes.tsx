import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { maskPhone } from "@/lib/format";
import { useMyShop, useWorkingHours, type WorkingHour } from "@/lib/shop";

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

  useEffect(() => {
    if (!shop) return;
    setName(shop.name);
    setPhone(shop.phone ?? "");
    setAddress(shop.address ?? "");
  }, [shop]);

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
        {shop && (
          <p className="mt-4 text-sm text-muted-foreground">
            Página pública de agendamento:{" "}
            <a
              className="text-primary"
              href={`/barbearia/${shop.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              /barbearia/{shop.slug}
            </a>
          </p>
        )}
        <Button className="mt-4 h-11" onClick={saveShop} disabled={savingShop || !shop}>
          {savingShop ? "Salvando…" : "Salvar"}
        </Button>
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
