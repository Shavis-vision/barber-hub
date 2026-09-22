import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { homeForRole, useAccessProfile, type Role } from "@/lib/roles";

/**
 * Guarda de rota por papel. Não faz logout: a sessão do Supabase continua ativa,
 * apenas o conteúdo é substituído por um aviso de acesso restrito.
 */
export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { data: profile, isLoading } = useAccessProfile();

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!allow.includes(profile.role)) {
    const home = homeForRole(profile.role);
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
          <p className="label-caps">Acesso restrito</p>
          <h1 className="mt-2 text-xl font-semibold">Esta página não está disponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile.role === "barber"
              ? "Seu acesso de barbeiro permite ver a agenda e seus atendimentos."
              : "Sua conta não administra uma barbearia."}
          </p>
          <Link to={home} className="mt-6 block">
            <Button className="h-11 w-full">
              {profile.role === "barber" ? "Ir para minha agenda" : "Voltar ao início"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
