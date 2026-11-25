// Opções de personalização da página pública (devem bater com as regras do banco).

export type PageIcon = "initials" | "scissors" | "razor" | "comb" | "image";

export const ICON_COLORS = [
  { id: "ink", name: "Quase preto", hex: "#15191b" },
  { id: "petroleo", name: "Petróleo", hex: "#165a6e" },
  { id: "vinho", name: "Vinho", hex: "#5a2430" },
  { id: "floresta", name: "Floresta", hex: "#22423a" },
  { id: "bronze", name: "Bronze", hex: "#8a6a3f" },
] as const;

export const BANNER_SOLIDS = [
  { id: "petroleo", name: "Petróleo", css: "#165a6e" },
  { id: "grafite", name: "Grafite", css: "#24292c" },
  { id: "areia", name: "Areia", css: "#cdbfa9" },
  { id: "vinho", name: "Vinho", css: "#5a2430" },
  { id: "floresta", name: "Floresta", css: "#22423a" },
] as const;

export const BANNER_PATTERNS = [
  {
    id: "listras",
    name: "Listras",
    css: "repeating-linear-gradient(135deg, #165a6e 0 22px, #1c6880 22px 44px)",
  },
  {
    id: "riscado",
    name: "Riscado",
    css: "repeating-linear-gradient(45deg, #24292c 0 3px, #2c3337 3px 11px)",
  },
  {
    id: "pontilhado",
    name: "Pontilhado",
    css: "radial-gradient(rgba(255,255,255,.16) 1.3px, transparent 1.6px) 0 0 / 14px 14px, #165a6e",
  },
  {
    id: "quadriculado",
    name: "Quadriculado",
    css: "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 22px 22px, #24292c",
  },
] as const;

export type PageLook = {
  name: string;
  page_icon: string;
  page_icon_color: string;
  page_banner: string;
  logo_url: string | null;
  banner_url: string | null;
};

export function bannerBackground(look: Pick<PageLook, "page_banner" | "banner_url">) {
  if (look.page_banner === "image" && look.banner_url) {
    return `center / cover no-repeat url("${look.banner_url}")`;
  }
  const all = [...BANNER_SOLIDS, ...BANNER_PATTERNS];
  return (all.find((b) => b.id === look.page_banner) ?? BANNER_SOLIDS[0]).css;
}

export function iconColor(id: string) {
  return (ICON_COLORS.find((c) => c.id === id) ?? ICON_COLORS[0]).hex;
}

// Palavras que não ajudam a reconhecer a barbearia nas iniciais.
const GENERIC_WORDS = new Set(["barbearia", "barber", "barbershop", "barbeiro", "salão", "salao", "shop"]);

export function initials(name: string) {
  const words = name.split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  const specific = words.filter((w) => !GENERIC_WORDS.has(w.toLowerCase()));
  const pick = specific.length > 0 ? specific : words;
  return (
    pick
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || name.slice(0, 2).toUpperCase()
  );
}

/**
 * Reduz a imagem no próprio navegador antes de enviar (economiza espaço e dados móveis).
 * Banner: até 1600 px de largura. Logo: quadrado de até 512 px.
 */
export async function shrinkImage(file: File, kind: "logo" | "banner" | "product"): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem muito grande (máximo 15 MB).");
  const bitmap = await createImageBitmap(file);
  const max = kind === "logo" ? 512 : kind === "product" ? 600 : 1600;
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (kind === "logo" || kind === "product") {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, max / sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  if (blob.size > 2 * 1024 * 1024)
    throw new Error("Imagem muito pesada mesmo após reduzir. Tente outra.");
  return blob;
}
