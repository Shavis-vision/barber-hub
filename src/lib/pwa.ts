import { useSyncExternalStore } from "react";

/** Evento que Chrome/Edge/Android disparam quando o site pode ser instalado. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  // Captura cedo (antes de qualquer tela montar), senão o evento se perde.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Registra o trabalhador de fundo (só no site publicado). */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD || ["localhost", "127.0.0.1"].includes(location.hostname)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* sem o trabalhador o site funciona normalmente; só não instala em alguns navegadores */
  });
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    installed ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

type State = { canPrompt: boolean; ios: boolean; standalone: boolean };
const SERVER: State = { canPrompt: false, ios: false, standalone: false };
let snapshot: State = SERVER;

function read(): State {
  const next = { canPrompt: !!deferred, ios: isIOS(), standalone: isStandalone() };
  if (
    next.canPrompt !== snapshot.canPrompt ||
    next.ios !== snapshot.ios ||
    next.standalone !== snapshot.standalone
  ) {
    snapshot = next;
  }
  return snapshot;
}

export function useInstallApp() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => SERVER,
  );
  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  }
  return {
    ...state,
    /** Dá para oferecer a instalação neste aparelho (com um toque ou com instruções no iPhone). */
    available: !state.standalone && (state.canPrompt || state.ios),
    install,
  };
}
