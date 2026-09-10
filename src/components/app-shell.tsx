import { Link, useRouter } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Scissors,
  Settings,
  Users,
  UserRound,
  ExternalLink,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop } from "@/lib/shop";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/barbeiros", label: "Barbeiros", icon: UserRound },
  { to: "/servicos", label: "Serviços", icon: Scissors },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const MOBILE_NAV = NAV.filter((item) =>
  ["/dashboard", "/agenda", "/clientes", "/servicos", "/configuracoes"].includes(item.to),
);

export function AppShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { data: shop } = useMyShop();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-sidebar px-3 py-5 lg:flex">
        <div className="px-3 pb-6">
          <p className="font-display text-lg font-semibold tracking-tight">Navalha</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {shop?.name ?? "Carregando…"}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground font-medium" }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 border-t border-border pt-3">
          {shop && (
            <a
              href={`/barbearia/${shop.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              Página pública
            </a>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-sm">
          <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-6 lg:py-5">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
              {description && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {action}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 sm:px-6 lg:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] text-muted-foreground"
              activeProps={{ className: "text-primary font-medium" }}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("size-5", isActive && "text-primary")} aria-hidden />
                  <span className="truncate">{label}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
