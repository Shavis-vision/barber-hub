import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Barber } from "@/lib/shop";

type Invite = { id: string; code: string; expires_at: string };

/** Convite e vínculo de conta de um barbeiro. Só o dono acessa (RLS em barber_invites). */
export function InviteSection({ shopId, barber }: { shopId: string; barber: Barber }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const linked = !!barber.user_id;

  const invite = useQuery({
    queryKey: ["barber-invite", barber.id],
    enabled: !linked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barber_invites" as never)
        .select("id, code, expires_at")
        .eq("barber_id", barber.id)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Invite | null;
    },
  });

  const link = invite.data ? `${window.location.origin}/convite/${invite.data.code}` : null;

  async function generate() {
    setBusy(true);
    try {
      const { error: delErr } = await supabase
        .from("barber_invites" as never)
        .delete()
        .eq("barber_id", barber.id)
        .is("used_at", null);
      if (delErr) throw delErr;
      const { error } = await supabase
        .from("barber_invites" as never)
        .insert({ barbershop_id: shopId, barber_id: barber.id } as never);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["barber-invite", barber.id] });
      toast.success("Convite gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o convite.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!confirm(`Desvincular a conta de ${barber.name}? Ela perderá o acesso à agenda.`)) return;
    setBusy(true);
    try {
      const userId = barber.user_id!;
      const { error } = await supabase.from("barbers").update({ user_id: null }).eq("id", barber.id);
      if (error) throw error;
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "barber")
        .eq("barbershop_id", shopId);
      await queryClient.invalidateQueries({ queryKey: ["barbers"] });
      toast.success("Conta desvinculada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desvincular.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border px-3.5 py-3">
      <Label className="text-sm">Acesso do barbeiro</Label>
      {linked ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Conta ligada</span>
          <Button type="button" variant="outline" size="sm" onClick={unlink} disabled={busy}>
            Desvincular
          </Button>
        </div>
      ) : !barber.active ? (
        <p className="text-sm text-muted-foreground">Ative o barbeiro para convidar.</p>
      ) : invite.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : link ? (
        <>
          <p className="text-xs text-muted-foreground">
            Envie este link ao barbeiro. Vale até{" "}
            {new Date(invite.data!.expires_at).toLocaleDateString("pt-BR")}.
          </p>
          <Input readOnly value={link} className="h-10 text-xs" onFocus={(e) => e.target.select()} />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("Link copiado.");
              }}
            >
              <Copy className="size-4" aria-hidden /> Copiar link
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={generate} disabled={busy}>
              Gerar novo
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Sem conta ligada</span>
          <Button type="button" size="sm" onClick={generate} disabled={busy}>
            Convidar
          </Button>
        </div>
      )}
    </div>
  );
}
