import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarX, Loader2 } from "lucide-react";
import { ManageActions } from "@/components/manage-appointment";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { hhmm, longDate, money } from "@/lib/format";
import { getManagedAppointment } from "@/lib/manage";

export const Route = createFileRoute("/agendamento/$token")({
  head: () => ({
    meta: [
      { title: "Meu agendamento | Cortezy" },
      { name: "description", content: "Veja, remarque ou cancele o seu horário." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["managed-appointment", token],
    queryFn: () => getManagedAppointment(token),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["managed-appointment", token] });
  const a = q.data;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-xl px-4 py-5">
          <p className="text-lg font-semibold">{a?.found ? a.shop_name : "Cortezy"}</p>
          <p className="text-sm text-muted-foreground">Seu agendamento</p>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">
        {q.isLoading ? (
          <div className="flex justify-center py-16" aria-busy aria-label="Carregando">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : q.isError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Não foi possível carregar. Tente de novo em instantes.</span>
          </div>
        ) : !a?.found ? (
          <div className="panel p-8 text-center">
            <CalendarX className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold">Link não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Confira se o link foi copiado por inteiro, ou fale com a barbearia.
            </p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight">
                  {longDate(new Date(a.starts_at))}
                </h1>
                <p className="numeric text-2xl font-semibold">{hhmm(a.starts_at)}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <dl className="divide-y divide-border border-t border-border text-sm">
              <Row label="Serviço" value={a.service_name} />
              <Row label="Barbeiro" value={a.barber_name} />
              <Row label="Valor" value={money(a.price_cents)} />
              {a.shop_phone && <Row label="Telefone da barbearia" value={a.shop_phone} />}
            </dl>
            <div className="space-y-3 border-t border-border p-4">
              <ManageActions
                target={{ kind: "token", token }}
                shopSlug={a.shop_slug}
                serviceId={a.service_id}
                barberId={a.barber_id}
                startsAt={a.starts_at}
                status={a.status}
                shopPhone={a.shop_phone}
                onChanged={refresh}
              />
              {a.status === "cancelled" && (
                <Link to="/barbearia/$slug" params={{ slug: a.shop_slug }} className="block">
                  <Button className="h-12 w-full">Agendar outro horário</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="numeric truncate text-right font-medium">{value}</dd>
    </div>
  );
}
