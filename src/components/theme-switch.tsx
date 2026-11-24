import { Moon, Sun } from "lucide-react";
import { useIsDark, useThemeMode, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "auto", label: "Automático" },
];

/** Seletor Claro / Escuro / Automático, para menus e configurações. */
export function ThemeSegmented({ className }: { className?: string }) {
  const [mode, setMode] = useThemeMode();
  return (
    <div className={className}>
      <div
        role="group"
        aria-label="Aparência"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={mode === o.value}
            onClick={() => setMode(o.value)}
            className={cn(
              "press h-11 rounded-lg text-sm text-foreground",
              mode === o.value
                ? "bg-card font-semibold shadow-sm"
                : "font-medium text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Automático segue o tema do celular.</p>
    </div>
  );
}

/** Botão redondo que alterna claro/escuro (usado na página pública). */
export function ThemeToggleButton({ className }: { className?: string }) {
  const dark = useIsDark();
  const [, setMode] = useThemeMode();
  return (
    <button
      type="button"
      onClick={() => setMode(dark ? "light" : "dark")}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      className={cn("press flex size-11 items-center justify-center rounded-full", className)}
    >
      {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
