import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { groupSlots, useAvailableSlots } from "@/lib/booking";
import {
  useBarbers,
  useServices,
  type AppointmentRow,
  type Barbershop,
  type Service,
} from "@/lib/shop";
import { hhmm, longDate, maskPhone, minutesBetween, money, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
    queryClient.invalidateQueries({ queryKey: ["customer-history"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["slots"] });
  };
}

function SlotPicker({
  shop,
  serviceId,
  barberId,
  dateKey,
  value,
  onChange,
}: {
  shop: Barbershop;
  serviceId: string | null;
  barberId: string | null;
  dateKey: string;
  value: string | null;
  onChange: (slotAt: string) => void;
}) {
  const { data: slots, isLoading } = useAvailableSlots(shop.slug, serviceId, barberId, dateKey);
  const grouped = groupSlots(slots ?? []);

  if (!serviceId) return <p className="text-sm text-muted-foreground">Escolha um serviço.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Buscando horários…</p>;
  if (!grouped.length)
    return (
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Nenhum horário livre nesta data.
      </p>
    );

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {grouped.map(({ slotAt }) => (
        <button
          key={slotAt}
          type="button"
          onClick={() => onChange(slotAt)}
          aria-pressed={value === slotAt}
          className={cn(
            "numeric h-11 rounded-lg border text-sm font-medium transition-colors",
            value === slotAt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:border-border-strong",
          )}
        >
          {hhmm(slotAt)}
        </button>
      ))}
    </div>
  );
}

export function NewAppointmentDialog({
  shop,
  open,
  onOpenChange,
  defaultDate,
}: {
  shop: Barbershop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
}) {
  const refresh = useRefresh();
  const { data: services } = useServices(shop.id);
  const { data: barbers } = useBarbers(shop.id);
  const activeServices = (services ?? []).filter((s) => s.active);
  const activeBarbers = (barbers ?? []).filter((b) => b.active);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState(toDateKey(defaultDate ?? new Date()));
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const service = activeServices.find((s) => s.id === serviceId) as Service | undefined;

  async function save() {
    if (!serviceId || !slot || !name.trim() || !phone.trim()) {
      toast.error("Preencha serviço, horário, nome e telefone.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("book_appointment", {
        p_slug: shop.slug,
        p_service: serviceId,
        p_barber: barberId as unknown as string,
        p_slot: slot,
        p_name: name.trim(),
        p_phone: phone.trim(),
      });
      if (error) throw error;

      const appointmentId = (data as { appointment_id?: string } | null)?.appointment_id;
      if (appointmentId && notes.trim()) {
        await supabase
          .from("appointments")
          .update({ notes: notes.trim(), source: "manual" })
          .eq("id", appointmentId);
      } else if (appointmentId) {
        await supabase.from("appointments").update({ source: "manual" }).eq("id", appointmentId);
      }

      toast.success("Agendamento criado.");
      refresh();
      onOpenChange(false);
      setServiceId(null);
      setSlot(null);
      setName("");
      setPhone("");
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível agendar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Escolha serviço, barbeiro e horário. Só aparecem horários realmente livres.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Select
              value={serviceId ?? undefined}
              onValueChange={(v) => {
                setServiceId(v);
                setSlot(null);
              }}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {activeServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {money(s.price_cents)} · {s.duration_minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Barbeiro</Label>
            <Select
              value={barberId ?? "any"}
              onValueChange={(v) => {
                setBarberId(v === "any" ? null : v);
                setSlot(null);
              }}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer barbeiro disponível</SelectItem>
                {activeBarbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              className="h-11"
              value={dateKey}
              onChange={(e) => {
                setDateKey(e.target.value);
                setSlot(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Horário</Label>
            <SlotPicker
              shop={shop}
              serviceId={serviceId}
              barberId={barberId}
              dateKey={dateKey}
              value={slot}
              onChange={setSlot}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Cliente</Label>
              <Input
                id="name"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                className="h-11"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {service && slot && (
            <p className="numeric rounded-lg bg-muted/50 p-3 text-sm">
              {service.name} · {hhmm(slot)} · {money(service.price_cents)}
            </p>
          )}

          <Button onClick={save} disabled={saving} className="h-12 w-full">
            {saving ? "Salvando…" : "Confirmar agendamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AppointmentDetailDialog({
  shop,
  appointment,
  onOpenChange,
}: {
  shop: Barbershop;
  appointment: AppointmentRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const refresh = useRefresh();
  const [rescheduling, setRescheduling] = useState(false);
  const [dateKey, setDateKey] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = !!appointment;

  async function setStatus(status: string) {
    if (!appointment) return;
    setBusy(true);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status atualizado.");
    refresh();
    onOpenChange(false);
  }

  async function reschedule() {
    if (!appointment || !slot) return;
    const duration = appointment.services?.duration_minutes ?? 30;
    setBusy(true);
    const { error } = await supabase
      .from("appointments")
      .update({
        starts_at: slot,
        ends_at: new Date(new Date(slot).getTime() + duration * 60000).toISOString(),
      })
      .eq("id", appointment.id);
    setBusy(false);
    if (error) {
      toast.error("Este horário não está livre. Escolha outro.");
      return;
    }
    toast.success("Agendamento remarcado.");
    refresh();
    setRescheduling(false);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRescheduling(false);
          setSlot(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        {appointment && (
          <>
            <DialogHeader>
              <DialogTitle className="numeric">
                {hhmm(appointment.starts_at)} · {appointment.customers?.name}
              </DialogTitle>
              <DialogDescription>
                {longDate(new Date(appointment.starts_at))}
              </DialogDescription>
            </DialogHeader>

            <dl className="divide-y divide-border rounded-xl border border-border">
              {[
                ["Serviço", appointment.services?.name ?? "—"],
                ["Barbeiro", appointment.barbers?.name ?? "—"],
                [
                  "Duração",
                  `${minutesBetween(appointment.starts_at, appointment.ends_at)} minutos`,
                ],
                ["Valor", money(appointment.price_cents)],
                ["Telefone", appointment.customers?.phone ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="numeric truncate text-sm font-medium">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={appointment.status} />
                </dd>
              </div>
            </dl>

            {appointment.notes && (
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                {appointment.notes}
              </p>
            )}

            {rescheduling ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-date">Nova data</Label>
                  <Input
                    id="new-date"
                    type="date"
                    className="h-11"
                    value={dateKey || toDateKey(new Date(appointment.starts_at))}
                    onChange={(e) => {
                      setDateKey(e.target.value);
                      setSlot(null);
                    }}
                  />
                </div>
                <SlotPicker
                  shop={shop}
                  serviceId={appointment.service_id}
                  barberId={appointment.barber_id}
                  dateKey={dateKey || toDateKey(new Date(appointment.starts_at))}
                  value={slot}
                  onChange={setSlot}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-11 flex-1"
                    onClick={() => setRescheduling(false)}
                  >
                    Voltar
                  </Button>
                  <Button className="h-11 flex-1" disabled={!slot || busy} onClick={reschedule}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={busy}
                    onClick={() => setRescheduling(true)}
                  >
                    Remarcar
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={busy}
                    onClick={() => setStatus("completed")}
                  >
                    Concluir
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    className="h-11"
                    disabled={busy}
                    onClick={() => setStatus("no_show")}
                  >
                    Não compareceu
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11 text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => setStatus("cancelled")}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
