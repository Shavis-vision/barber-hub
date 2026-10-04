import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const PENDING_KEY = "navalha:pending-invite";

export const Route = createFileRoute("/convite/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite de barbeiro — Navalha" },
      { name: "description", content: "Aceite o convite para acessar sua agenda no Navalha." },
      { property: "og:title", content: "Convite de barbeiro — Navalha" },
      { property: "og:description", content: "Ligue sua conta ao cadastro de barbeiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

type InviteInfo = { status: "valid" | "used" | "expired" | "invalid"; barber_name?: string; shop_name?: string };

function InvitePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = useQuery({
    queryKey: ["invite-session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const user = session.data;

  const info = useQuery({
    queryKey: ["invite", code],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_barber_invite" as never, { p_code: code } as never);
      if (error) throw error;
      return data as unknown as InviteInfo;
    },
  });

  useEffect(() => {
    if (session.isSuccess && !user) sessionStorage.setItem(PENDING_KEY, code);
  }, [session.isSuccess, user, code]);

  async function accept() {
    setAccepting(true);
    setError(null);
    const { error } = await supabase.rpc("accept_barber_invite" as never, { p_code: code } as never);
    setAccepting(false);
    if (error) {
      setError(error.message);
      return;
    }
    sessionStorage.removeItem(PENDING_KEY);
    await queryClient.invalidateQueries({ queryKey: ["access-profile"] });
    await queryClient.invalidateQueries({ queryKey: ["my-shop"] });
    toast.success("Convite aceito. Bem-vindo à equipe!");
    navigate({ to: "/agenda" });
  }

  function dismiss() {
    sessionStorage.removeItem(PENDING_KEY);
    navigate({ to: "/inicio" });
  }

  const statusMsg: Record<string, string> = {
    invalid: "Convite inválido.",
    used: "Este convite já foi usado.",
    expired: "Este convite expirou. Peça um novo ao dono da barbearia.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="panel w-full max-w-sm p-6">
        <p className="font-display text-lg font-semibold">Navalha</p>
        <h1 className="mt-4 text-xl font-semibold">Convite de barbeiro</h1>

        {session.isLoading || (user && info.isLoading) ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : !user ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Entre ou crie sua conta (opção "Sou cliente") para aceitar o convite. Depois de entrar, você volta para cá.
            </p>
            <Button asChild className="mt-6 h-12 w-full">
              <Link to="/auth">Entrar ou criar conta</Link>
            </Button>
          </>
        ) : info.data?.status === "valid" ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{info.data.shop_name}</span> convidou você para
              acessar a agenda como <span className="font-medium text-foreground">{info.data.barber_name}</span>.
            </p>
            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={accept} disabled={accepting} className="mt-6 h-12 w-full">
              {accepting ? "Aceitando…" : "Aceitar convite"}
            </Button>
            <Button variant="ghost" onClick={dismiss} className="mt-2 h-11 w-full">
              Agora não
            </Button>
          </>
        ) : (
          <>
            <p role="alert" className="mt-2 text-sm text-destructive">
              {statusMsg[info.data?.status ?? "invalid"] ?? "Não foi possível abrir o convite."}
            </p>
            <Button variant="outline" onClick={dismiss} className="mt-6 h-11 w-full">
              Ir para minha área
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
