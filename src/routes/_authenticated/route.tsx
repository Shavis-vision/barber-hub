import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Lê a sessão guardada no navegador (sem chamada de rede). A segurança dos dados continua
    // sendo garantida pelo banco; aqui só decidimos se mostramos a tela ou o login.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  pendingMs: 0,
  pendingComponent: () => (
    <div
      role="status"
      className="grid min-h-dvh place-items-center text-sm text-muted-foreground"
    >
      Carregando…
    </div>
  ),
  component: () => <Outlet />,
});
