import { Download, Share, SquarePlus, X } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInstallApp } from "@/lib/pwa";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "cortesy:install-dismissed";

/** Instruções do iPhone: a Apple não deixa o site instalar sozinho. */
function IosSteps({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Instalar o Cortesy no iPhone</DialogTitle>
          <DialogDescription>Leva 10 segundos. Use o Safari.</DialogDescription>
        </DialogHeader>
        <ol className="mt-2 space-y-4 text-[15px]">
          <li className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Share className="size-5" aria-hidden />
            </span>
            <span>
              Toque em <strong>Compartilhar</strong>, o quadrado com a seta para cima na barra do
              Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <SquarePlus className="size-5" aria-hidden />
            </span>
            <span>
              Role e escolha <strong>Adicionar à Tela de Início</strong>, depois{" "}
              <strong>Adicionar</strong>.
            </span>
          </li>
        </ol>
        <Button className="mt-4 h-11 w-full" onClick={() => onOpenChange(false)}>
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function useInstallAction() {
  const app = useInstallApp();
  const [iosOpen, setIosOpen] = useState(false);
  const run = () => {
    if (app.canPrompt) void app.install();
    else if (app.ios) setIosOpen(true);
  };
  const dialog = <IosSteps open={iosOpen} onOpenChange={setIosOpen} />;
  return { available: app.available, run, dialog };
}

/** Linha "Instalar o app" para menus. Some quando já está instalado ou não dá para instalar. */
export function InstallAppRow({ className }: { className?: string }) {
  const { available, run, dialog } = useInstallAction();
  if (!available) return null;
  return (
    <>
      <button
        type="button"
        onClick={run}
        className={cn("flex w-full items-center gap-3 text-left text-[15px]", className)}
      >
        <Download className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex-1">Instalar o app</span>
      </button>
      {dialog}
    </>
  );
}

/** Aviso no Início (só no celular), que pode ser dispensado. */
export function InstallAppBanner() {
  const { available, run, dialog } = useInstallAction();
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!available || hidden) return null;
  return (
    <section className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 lg:hidden">
      <img src="/icons/icon-192.png" alt="" className="size-11 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Instale o Cortesy</p>
        <p className="text-[13px] text-muted-foreground">Abre como um app, direto na sua agenda.</p>
      </div>
      <Button className="h-11 px-4" onClick={run}>
        Instalar
      </Button>
      <button
        type="button"
        aria-label="Dispensar"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ok */
          }
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
      {dialog}
    </section>
  );
}
