import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ExternalLink,
  History,
  House,
  LogOut,
  Menu,
  Package,
  Palette,
  Scissors,
  Settings,
  Users,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop } from "@/lib/shop";
import { useAccessProfile, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ThemeSegmented } from "@/components/theme-switch";
import { InstallAppBanner, InstallAppRow } from "@/components/install-app";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { to: "/dashboard", label: "Início", icon: House, roles: ["owner"] },
  { to: "/agenda", label: "Agenda", icon: CalendarRange, roles: ["owner", "barber"] },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarDays, roles: ["owner", "barber"] },
  { to: "/alteracoes", label: "Cancelamentos e remarcações", icon: History, roles: ["owner"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["owner"] },
  { to: "/barbeiros", label: "Barbeiros", icon: UserRound, roles: ["owner"] },
  { to: "/servicos", label: "Serviços", icon: Scissors, roles: ["owner"] },
  { to: "/estoque", label: "Estoque", icon: Package, roles: ["owner"] },
  { to: "/pagina", label: "Sua página", icon: Palette, roles: ["owner"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["owner"] },
  { to: "/perfil", label: "Meu perfil", icon: UserRound, roles: ["barber"] },
] as const satisfies ReadonlyArray<{
  to: string;
  label: string;
  icon: typeof Users;
  roles: readonly Role[];
}>;

// No celular: no máximo 4 atalhos + "Mais" (o resto fica no menu "Mais").
const MOBILE_FOR_OWNER = ["/dashboard", "/agenda", "/clientes", "/servicos"];
const MOBILE_FOR_BARBER = ["/agenda", "/agendamentos", "/perfil"];
const SHORT_LABEL: Record<string, string> = { "/agendamentos": "Horários" };

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
  const { data: profile } = useAccessProfile();
  const role: Role = profile?.role ?? "client";
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  const nav = NAV.filter((item) => (item.roles as readonly Role[]).includes(role));
  const mobilePaths: readonly string[] = role === "barber" ? MOBILE_FOR_BARBER : MOBILE_FOR_OWNER;
  const mobileNav = nav.filter((item) => mobilePaths.includes(item.to));
  const moreNav = nav.filter((item) => !mobilePaths.includes(item.to));
  const moreActive = moreOpen || moreNav.some((item) => pathname.startsWith(item.to));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar px-3 py-5 lg:flex">
        <div className="flex items-center gap-3 px-3 pb-6">
          <img src="/favicon.svg" alt="" className="size-9 rounded-[10px]" />
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-semibold [font-stretch:85%]">Cortesy</p>
            <p className="truncate text-xs text-muted-foreground">
              {shop?.name ?? "Carregando…"}
              {role === "owner" ? " · Dono" : role === "barber" ? " · Barbeiro" : ""}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 border-t border-border pt-3">
          <ThemeSegmented className="px-1 pb-3" />
          <InstallAppRow className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-4" />
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

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
          <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-6 lg:py-5">
            <div className="min-w-0">
              <h1 className="truncate text-2xl leading-tight font-semibold sm:text-[28px]">{title}</h1>
              {description && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {action}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:pb-12">
          {(pathname === "/dashboard" || pathname === "/agenda") && <InstallAppBanner />}
          {children}
        </main>
      </div>

      <nav
        aria-label="Menu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${mobileNav.length + 1}, minmax(0, 1fr))` }}
        >
          {mobileNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className="press flex min-h-15 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-muted-foreground"
              activeProps={{ className: "text-primary font-semibold" }}
            >
              <Icon className="size-[22px]" aria-hidden />
              <span className="truncate">{SHORT_LABEL[to] ?? label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "press flex min-h-15 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-muted-foreground",
              moreActive && "font-semibold text-primary",
            )}
          >
            <Menu className="size-[22px]" aria-hidden />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-card px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:hidden"
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden />
          <SheetTitle className="sr-only">Mais opções</SheetTitle>
          <SheetDescription className="sr-only">Outras telas, aparência e sair</SheetDescription>
          <ul className="divide-y divide-border">
            {moreNav.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="flex h-13 items-center gap-3 text-[15px]"
                  activeProps={{ className: "text-primary font-semibold" }}
                >
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <InstallAppRow className="h-13" />
            </li>
            {shop && (
              <li>
                <a
                  href={`/barbearia/${shop.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-13 items-center gap-3 text-[15px]"
                >
                  <ExternalLink className="size-5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">Ver página pública</span>
                </a>
              </li>
            )}
          </ul>
          <p className="mt-5 mb-2 text-sm text-muted-foreground">Aparência</p>
          <ThemeSegmented />
          <button
            onClick={signOut}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-[15px] font-medium text-destructive"
          >
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
