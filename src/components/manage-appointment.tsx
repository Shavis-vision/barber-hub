import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarClock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { groupSlots } from "@/lib/booking";
import { addDays, hhmm, longDate, shortDate, toDateKey, weekdayShort } from "@/lib/format";
import {
  MIN_NOTICE_HOURS,
  cancelAppointment,
  canChange,
  fetchRescheduleSlots,
  isActiveStatus,
  rescheduleAppointment,
  type ManageTarget,
} from "@/lib/manage";
import { cn } from "@/lib/utils";

type Props = {
  target: ManageTarget;
  shopSlug: string;
  serviceId: string;
  barberId: string;
  startsAt: string;
  status: string;
  shopPhone?: string | null | undefined;
  onChanged: () => void;
};

/** Botões "Remarcar" e "Cancelar" com a regra das 2 horas. A trava de verdade está no banco. */
export function ManageActions(props: Props) {
  const { target, startsAt, status, shopPhone, onChanged } = props;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  if (!isActiveStatus(status)) return null;

  if (!canChange(startsAt, status)) {
    return (
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Cancelar ou remarcar só é possível com pelo menos {MIN_NOTICE_HOURS} horas de antecedência.
        {shopPhone
          ? ` Para alterar agora, fale com a barbearia: ${shopPhone}.`
          : " Para alterar agora, fale com a barbearia."}
      </p>
    );
  }

  async function doCancel() {
    setBusy(true);
    try {
      await cancelAppointment(target);
      toast.success("Horário cancelado.");
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      setCancelOpen(false);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={() => setMoveOpen(true)}>
          <CalendarClock className="size-4" aria-hidden /> Remarcar
        </Button>
        <Button
          variant="outline"
          className="h-11 flex-1 text-destructive hover:text-destructive"
          onClick={() => setCancelOpen(true)}
        >
          <XCircle className="size-4" aria-hidden /> Cancelar
        </Button>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este horário?</AlertDialogTitle>
            <AlertDialogDescription>
              {longDate(new Date(startsAt))} às {hhmm(startsAt)}. O horário volta a ficar livre para
              outros clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Manter horário</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void doCancel();
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RescheduleDialog {...props} open={moveOpen} onOpenChange={setMoveOpen} />
    </>
  );
}

function RescheduleDialog({
  target,
  startsAt,
  open,
  onOpenChange,
  onChanged,
}: Props & { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targetKey = target.kind === "token" ? target.token : target.id;
  const slots = useQuery({
    queryKey: ["slots", "reschedule", targetKey, dateKey],
    enabled: open && !!dateKey,
    queryFn: () => fetchRescheduleSlots(target, dateKey!),
    staleTime: 15_000,
  });
  const grouped = groupSlots(slots.data ?? []);

  async function confirm() {
    if (!slot) return;
    setBusy(true);
    try {
      await rescheduleAppointment(target, slot);
      toast.success("Horário remarcado.");
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      onOpenChange(false);
      setSlot(null);
      setDateKey(null);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
      setSlot(null);
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remarcar horário</DialogTitle>
          <DialogDescription>
            Atual: {longDate(new Date(startsAt))} às {hhmm(startsAt)}. Mesmo serviço e mesmo
            barbeiro.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d, i) => {
            const key = toDateKey(d);
            const active = key === dateKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDateKey(key);
                  setSlot(null);
                }}
                aria-pressed={active}
                aria-label={longDate(d)}
                className={cn(
                  "flex h-[4.5rem] w-16 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] uppercase tracking-wide",
                    active ? "opacity-90" : "text-muted-foreground",
                  )}
                >
                  {i === 0 ? "Hoje" : weekdayShort(d.getDay())}
                </span>
                <span className="numeric text-lg font-semibold leading-none">
                  {shortDate(d).split("/")[0]}
                </span>
              </button>
            );
          })}
        </div>

        {dateKey &&
          (slots.isLoading ? (
            <div className="grid grid-cols-4 gap-2" aria-busy aria-label="Buscando horários">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : slots.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar os horários.
            </p>
          ) : grouped.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhum horário livre neste dia. Escolha outra data.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {grouped.map((g) => {
                const active = slot === g.slotAt;
                return (
                  <button
                    key={g.slotAt}
                    type="button"
                    onClick={() => setSlot(g.slotAt)}
                    aria-pressed={active}
                    className={cn(
                      "numeric h-11 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary",
                    )}
                  >
                    {hhmm(g.slotAt)}
                  </button>
                );
              })}
            </div>
          ))}

        <Button className="h-12" disabled={!slot || busy} onClick={confirm}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : slot ? (
            `Remarcar para ${hhmm(slot)}`
          ) : (
            "Escolha data e horário"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
