import type { ReactNode } from "react";
import { bannerBackground, iconColor, initials, type PageLook } from "@/lib/shop-page";
import { cn } from "@/lib/utils";

/** Ícone da barbearia: iniciais, símbolo desenhado ou logo enviado. */
export function ShopIcon({
  look,
  size = 80,
  className,
}: {
  look: PageLook;
  size?: number;
  className?: string;
}) {
  const glyph = Math.round(size * 0.42);
  const showImage = look.page_icon === "image" && look.logo_url;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden text-white dark:ring-1 dark:ring-white/15 dark:ring-inset",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        background: showImage ? "transparent" : iconColor(look.page_icon_color),
      }}
    >
      {showImage ? (
        <img src={look.logo_url!} alt="" className="size-full object-cover" />
      ) : look.page_icon === "scissors" ? (
        <Svg size={glyph}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
        </Svg>
      ) : look.page_icon === "razor" ? (
        <Svg size={glyph}>
          <path d="M3 15 15.5 5.5a2.1 2.1 0 0 1 3 2.9L8 18z" />
          <path d="M8 18l11 3" />
        </Svg>
      ) : look.page_icon === "comb" ? (
        <Svg size={glyph}>
          <rect x="3" y="6" width="18" height="4" rx="1.5" />
          <path d="M5 10v8M8 10v8M11 10v8M14 10v8M17 10v6M20 10v4" />
        </Svg>
      ) : (
        <span
          className="display-num font-bold"
          style={{ fontSize: Math.round(size * 0.35), lineHeight: 1 }}
        >
          {initials(look.name)}
        </span>
      )}
    </span>
  );
}

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Banner + ícone sobreposto, usado na página pública e na prévia do dono. */
export function ShopBanner({
  look,
  height = 148,
  iconSize = 80,
  ringClass = "border-background",
  children,
}: {
  look: PageLook;
  height?: number;
  iconSize?: number;
  ringClass?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="relative" style={{ height, background: bannerBackground(look) }}>
        {children}
      </div>
      <div className="relative z-10 px-5" style={{ marginTop: -Math.round(iconSize / 2) }}>
        <span
          className={cn("inline-block border-4", ringClass)}
          style={{ borderRadius: Math.round(iconSize * 0.3) }}
        >
          <ShopIcon look={look} size={iconSize} />
        </span>
      </div>
    </div>
  );
}
