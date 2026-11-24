import { useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "auto";

const KEY = "cortesy:theme";
const COLORS = { light: "#faf9f7", dark: "#0e1315" };

/**
 * Roda no <head> antes da página aparecer, para não "piscar" no tema errado.
 * Mantenha a lógica igual à de applyTheme().
 */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${KEY}");var d=m==="dark"||(m!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",d?"${COLORS.dark}":"${COLORS.light}")}catch(e){}})();`;

const listeners = new Set<() => void>();

function readMode(): ThemeMode {
  try {
    const m = localStorage.getItem(KEY);
    return m === "light" || m === "dark" ? m : "auto";
  } catch {
    return "auto";
  }
}

function systemIsDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(mode: ThemeMode = readMode()) {
  if (typeof document === "undefined") return;
  const dark = mode === "dark" || (mode === "auto" && systemIsDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? COLORS.dark : COLORS.light);
}

export function setThemeMode(mode: ThemeMode) {
  try {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
  applyTheme(mode);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Modo escolhido (claro, escuro ou automático). */
export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, () => "auto" as ThemeMode);
  return [mode, setThemeMode];
}

/** Se a tela está escura agora (considera o automático). */
export function useIsDark() {
  const [mode] = useThemeMode();
  const sys = useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    systemIsDark,
    () => false,
  );
  return mode === "dark" || (mode === "auto" && sys);
}

/** Acompanha a troca de tema do celular quando o modo é automático. */
export function useSystemThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readMode() === "auto") applyTheme("auto");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
}
