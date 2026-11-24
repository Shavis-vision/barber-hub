import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ExternalLink, ImageUp, Loader2, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { ShopBanner } from "@/components/shop-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, type Barbershop } from "@/lib/shop";
import {
  BANNER_PATTERNS,
  BANNER_SOLIDS,
  ICON_COLORS,
  shrinkImage,
  type PageLook,
} from "@/lib/shop-page";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pagina")({
  head: () => ({
    meta: [
      { title: "Sua página — Cortesy" },
      {
        name: "description",
        content: "Personalize o ícone e o banner da sua página de agendamento.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["owner"]}>
      <PagePage />
    </RoleGate>
  ),
});

const BUCKET = "shop-media";

type Pending = { blob: Blob; preview: string } | null;

function PagePage() {
  const { data: shop } = useMyShop();
  return (
    <AppShell
      title="Sua página"
      description="O que o cliente vê ao abrir o seu link de agendamento"
    >
      {shop ? <Editor shop={shop} /> : <p className="text-sm text-muted-foreground">Carregando…</p>}
    </AppShell>
  );
}

function Editor({ shop }: { shop: Barbershop }) {
  const queryClient = useQueryClient();
  const [icon, setIcon] = useState(shop.page_icon);
  const [color, setColor] = useState(shop.page_icon_color);
  const [banner, setBanner] = useState(shop.page_banner);
  const [logoUrl, setLogoUrl] = useState(shop.logo_url);
  const [bannerUrl, setBannerUrl] = useState(shop.banner_url);
  const [newLogo, setNewLogo] = useState<Pending>(null);
  const [newBanner, setNewBanner] = useState<Pending>(null);
  const [busy, setBusy] = useState<"logo" | "banner" | "save" | null>(null);

  // Libera a memória das prévias locais.
  useEffect(
    () => () => {
      if (newLogo) URL.revokeObjectURL(newLogo.preview);
    },
    [newLogo],
  );
  useEffect(
    () => () => {
      if (newBanner) URL.revokeObjectURL(newBanner.preview);
    },
    [newBanner],
  );

  const look: PageLook = {
    name: shop.name,
    page_icon: icon,
    page_icon_color: color,
    page_banner: banner,
    logo_url: newLogo?.preview ?? logoUrl,
    banner_url: newBanner?.preview ?? bannerUrl,
  };

  const dirty =
    icon !== shop.page_icon ||
    color !== shop.page_icon_color ||
    banner !== shop.page_banner ||
    logoUrl !== shop.logo_url ||
    bannerUrl !== shop.banner_url ||
    !!newLogo ||
    !!newBanner;

  async function pickFile(kind: "logo" | "banner", file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    try {
      const blob = await shrinkImage(file, kind);
      const pending = { blob, preview: URL.createObjectURL(blob) };
      if (kind === "logo") {
        setNewLogo(pending);
        setIcon("image");
      } else {
        setNewBanner(pending);
        setBanner("image");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível usar esta imagem.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(kind: "logo" | "banner", blob: Blob) {
    const path = `${shop.id}/${kind}-${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function storagePath(url: string | null) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = url?.indexOf(marker) ?? -1;
    return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
  }

  async function save() {
    setBusy("save");
    try {
      const finalLogo = newLogo ? await upload("logo", newLogo.blob) : logoUrl;
      const finalBanner = newBanner ? await upload("banner", newBanner.blob) : bannerUrl;
      const update = {
        page_icon: icon === "image" && !finalLogo ? "initials" : icon,
        page_icon_color: color,
        page_banner: banner === "image" && !finalBanner ? "petroleo" : banner,
        logo_url: finalLogo,
        banner_url: finalBanner,
      };
      const { error } = await supabase.from("barbershops").update(update).eq("id", shop.id);
      if (error) throw error;

      // Apaga as imagens antigas que foram trocadas ou removidas.
      const old = [
        shop.logo_url !== finalLogo && shop.logo_url,
        shop.banner_url !== finalBanner && shop.banner_url,
      ]
        .map((u) => (u ? storagePath(u) : null))
        .filter((p): p is string => !!p);
      if (old.length) await supabase.storage.from(BUCKET).remove(old);

      setLogoUrl(finalLogo);
      setBannerUrl(finalBanner);
      setNewLogo(null);
      setNewBanner(null);
      toast.success("Página atualizada.");
      queryClient.invalidateQueries({ queryKey: ["my-shop"] });
      queryClient.invalidateQueries({ queryKey: ["public-shop"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  const hasLogo = !!(newLogo || logoUrl);
  const hasBannerImage = !!(newBanner || bannerUrl);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <section aria-label="Prévia" className="lg:sticky lg:top-28">
        <div className="panel overflow-hidden">
          <ShopBanner look={look} height={110} iconSize={64} ringClass="border-card" />
          <div className="px-5 pt-2 pb-5">
            <p className="font-display text-[22px] leading-tight font-bold [font-stretch:85%]">
              {shop.name}
            </p>
            {shop.address && <p className="mt-0.5 text-sm text-muted-foreground">{shop.address}</p>}
          </div>
        </div>
        <a
          href={`/barbearia/${shop.slug}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ExternalLink className="size-4" aria-hidden /> Ver minha página
        </a>
      </section>

      <div>
        <h2 className="text-[17px] font-semibold">Ícone</h2>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          <IconChoice on={icon === "initials"} onClick={() => setIcon("initials")} label="Iniciais">
            <span className="display-num text-base font-bold">Aa</span>
          </IconChoice>
          <IconChoice on={icon === "scissors"} onClick={() => setIcon("scissors")} label="Tesoura">
            <Glyph
              d={
                <>
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
                </>
              }
            />
          </IconChoice>
          <IconChoice on={icon === "razor"} onClick={() => setIcon("razor")} label="Navalha">
            <Glyph
              d={
                <>
                  <path d="M3 15 15.5 5.5a2.1 2.1 0 0 1 3 2.9L8 18z" />
                  <path d="M8 18l11 3" />
                </>
              }
            />
          </IconChoice>
          <IconChoice on={icon === "comb"} onClick={() => setIcon("comb")} label="Pente">
            <Glyph
              d={
                <>
                  <rect x="3" y="6" width="18" height="4" rx="1.5" />
                  <path d="M5 10v8M8 10v8M11 10v8M14 10v8M17 10v6M20 10v4" />
                </>
              }
            />
          </IconChoice>
          {hasLogo && (
            <IconChoice on={icon === "image"} onClick={() => setIcon("image")} label="Seu logo">
              <img
                src={(newLogo?.preview ?? logoUrl)!}
                alt=""
                className="size-6 rounded-md object-cover"
              />
            </IconChoice>
          )}
        </div>
        <FileButton
          busy={busy === "logo"}
          onFile={(f) => pickFile("logo", f)}
          icon={<Upload className="size-4" aria-hidden />}
          label={hasLogo ? "Trocar logo" : "Enviar logo da barbearia"}
        />

        {icon !== "image" && (
          <>
            <p className="mt-5 mb-2 text-sm text-muted-foreground">Cor do fundo do ícone</p>
            <div className="flex flex-wrap gap-3">
              {ICON_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={color === c.id}
                  onClick={() => setColor(c.id)}
                  className={cn(
                    "press size-11 rounded-full",
                    color === c.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </>
        )}

        <h2 className="mt-9 text-[17px] font-semibold">Banner</h2>
        <p className="mt-3 mb-2 text-sm text-muted-foreground">Cores lisas</p>
        <div className="flex flex-wrap gap-3">
          {BANNER_SOLIDS.map((b) => (
            <Swatch
              key={b.id}
              name={b.name}
              css={b.css}
              on={banner === b.id}
              onClick={() => setBanner(b.id)}
              className="h-11 w-14"
            />
          ))}
        </div>
        <p className="mt-5 mb-2 text-sm text-muted-foreground">Texturas discretas</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BANNER_PATTERNS.map((b) => (
            <Swatch
              key={b.id}
              name={b.name}
              css={b.css}
              on={banner === b.id}
              onClick={() => setBanner(b.id)}
              className="h-16 w-full"
              showName
            />
          ))}
          {hasBannerImage && (
            <Swatch
              name="Sua foto"
              css={`center / cover no-repeat url("${newBanner?.preview ?? bannerUrl}")`}
              on={banner === "image"}
              onClick={() => setBanner("image")}
              className="h-16 w-full"
              showName
            />
          )}
        </div>
        <FileButton
          busy={busy === "banner"}
          onFile={(f) => pickFile("banner", f)}
          icon={<ImageUp className="size-4" aria-hidden />}
          label={hasBannerImage ? "Trocar foto do banner" : "Usar uma foto minha"}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          JPG, PNG ou WEBP. Ideal 1200 × 400. A imagem é reduzida automaticamente.
        </p>
        {hasBannerImage && (
          <button
            type="button"
            onClick={() => {
              setNewBanner(null);
              setBannerUrl(null);
              if (banner === "image") setBanner("petroleo");
            }}
            className="mt-2 inline-flex h-11 items-center gap-2 text-sm font-medium text-destructive"
          >
            <Trash2 className="size-4" aria-hidden /> Remover foto do banner
          </button>
        )}

        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-8 lg:static">
          <Button
            className="h-12 w-full text-base shadow-lg lg:w-auto lg:px-8 lg:shadow-none"
            disabled={!dirty || !!busy}
            onClick={save}
          >
            {busy === "save" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Salvando…
              </>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Use apenas imagens da sua barbearia ou que você tenha direito de usar.
        </p>
      </div>
    </div>
  );
}

function IconChoice({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "press flex h-16 flex-col items-center justify-center gap-1 rounded-xl border bg-card text-xs",
        on ? "border-2 border-primary font-semibold" : "border-border",
      )}
    >
      {children}
      {label}
    </button>
  );
}

function Glyph({ d }: { d: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d}
    </svg>
  );
}

function Swatch({
  name,
  css,
  on,
  onClick,
  className,
  showName,
}: {
  name: string;
  css: string;
  on: boolean;
  onClick: () => void;
  className?: string;
  showName?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "press flex items-end rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-white",
        on && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
      style={{ background: css }}
    >
      {showName && <span className="drop-shadow">{name}</span>}
    </button>
  );
}

function FileButton({
  busy,
  onFile,
  icon,
  label,
}: {
  busy: boolean;
  onFile: (file: File | undefined) => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <label className="press relative mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-sm font-semibold text-primary focus-within:ring-2 focus-within:ring-ring">
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {busy ? "Preparando imagem…" : label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="absolute size-px opacity-0"
        disabled={busy}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
