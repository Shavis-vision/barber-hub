import { createFileRoute, Navigate } from "@tanstack/react-router";
import { homeForRole, useAccessProfile } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Entrando — Navalha" },
      { name: "description", content: "Direcionando para a sua área no Navalha." },
      { property: "og:title", content: "Entrando — Navalha" },
      { property: "og:description", content: "Direcionando para a sua área no Navalha." },
    ],
  }),
  component: StartPage,
});

/** Envia cada papel para a sua área inicial, sem expor o painel a quem não pode vê-lo. */
function StartPage() {
  const { data: profile } = useAccessProfile();
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }
  const pendingInvite =
    typeof window !== "undefined" ? sessionStorage.getItem("navalha:pending-invite") : null;
  if (pendingInvite && /^[a-f0-9]{64}$/.test(pendingInvite)) {
    return <Navigate to="/convite/$code" params={{ code: pendingInvite }} replace />;
  }
  return <Navigate to={homeForRole(profile.role)} replace />;
}
