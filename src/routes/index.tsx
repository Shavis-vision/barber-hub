import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronDown, Clock, Copy, Mail, Palette, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { ShopIcon } from "@/components/shop-header";
import { ThemeToggleButton } from "@/components/theme-switch";
import { bannerBackground, type PageLook } from "@/lib/shop-page";
import { cn } from "@/lib/utils";

// Endereço que recebe mensagens (Email Routing do Cloudflare).
const CONTACT_EMAIL = "atendimento@cortesy.com.br";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cortesy — Agendamento online para barbearias" },
      {
        name: "description",
        content:
          "A agenda da sua barbearia aberta 24 horas: página de agendamento com a sua marca, agenda por barbeiro e faturamento no celular.",
      },
      { property: "og:title", content: "Cortesy — Agendamento online para barbearias" },
      {
        property: "og:description",
        content: "A agenda da sua barbearia, aberta 24 horas.",
      },
    ],
  }),
  component: Landing,
});

const CHECKS = [
  "O cliente não precisa criar conta",
  "Funciona no celular e no computador",
  "Cada barbeiro com a própria agenda",
];

const FEATURES = [
  {
    icon: Clock,
    title: "Agendamento 24 horas",
    text: "O cliente marca a qualquer hora, até com a barbearia fechada.",
  },
  {
    icon: Palette,
    title: "Sua marca, sua página",
    text: "Logo, banner e cores da sua barbearia na página de agendamento.",
  },
  {
    icon: Wallet,
    title: "Faturamento na palma da mão",
    text: "Quanto entrou, quanto falta receber e a comissão de cada barbeiro.",
  },
];

// Barbearias fictícias para a vitrine (sem nomes de pessoas).
const EXAMPLES: (PageLook & { place: string; slots: string[] })[] = [
  {
    name: "Barbearia Ponto Norte",
    place: "Asa Norte, Brasília",
    page_icon: "initials",
    page_icon_color: "ink",
    page_banner: "listras",
    logo_url: null,
    banner_url: null,
    slots: ["09:00", "10:30", "14:15"],
  },
  {
    name: "Corte Fino",
    place: "Taguatinga",
    page_icon: "razor",
    page_icon_color: "bronze",
    page_banner: "riscado",
    logo_url: null,
    banner_url: null,
    slots: ["11:00", "15:30", "18:00"],
  },
  {
    name: "Studio Raiz",
    place: "Águas Claras",
    page_icon: "comb",
    page_icon_color: "floresta",
    page_banner: "areia",
    logo_url: null,
    banner_url: null,
    slots: ["08:30", "13:00", "16:45"],
  },
];

const FAQ = [
  {
    q: "Meu cliente precisa criar conta?",
    a: "Não. Para agendar ele informa só o nome e o WhatsApp. Se quiser, pode criar uma conta para ver o histórico.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. Tanto a sua parte quanto a página do cliente foram feitas para o celular primeiro, e funcionam também no computador.",
  },
  {
    q: "Cada barbeiro tem a própria agenda?",
    a: "Sim. Cada barbeiro tem a agenda dele, os serviços que faz e os dias e horários em que atende. Você convida cada um por um link, e ele vê só o que é dele.",
  },
  {
    q: "E se o cliente precisar cancelar ou remarcar?",
    a: "Ele faz isso sozinho pelo link que recebe ao agendar, até 2 horas antes. Você vê quem mudou e com quanta antecedência.",
  },
  {
    q: "Posso colocar o logo da minha barbearia?",
    a: "Sim. Você envia o logo e uma foto para o banner, ou escolhe entre ícones, cores e texturas prontas.",
  },
];

const H2 = "font-display text-[34px] leading-[1.05] font-bold [font-stretch:85%] sm:text-[42px]";

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sm:px-6">
        <span className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8 rounded-[9px]" />
          <span className="font-display text-xl font-bold [font-stretch:85%]">Cortesy</span>
        </span>
        <nav aria-label="Seções" className="hidden items-center gap-1 md:flex">
          {[
            ["#como-funciona", "Como funciona"],
            ["#perguntas", "Perguntas"],
            ["#contato", "Contato"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="flex h-11 items-center rounded-md px-3 text-[15px] text-muted-foreground hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
        <span className="flex items-center gap-1.5">
          <ThemeToggleButton className="border border-border bg-card" />
          <Link to="/auth" className="flex h-11 items-center px-3 text-[15px] font-semibold">
            Entrar
          </Link>
        </span>
      </header>

      <main>
        {/* Topo: título + o produto */}
        <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-14 px-5 pt-8 pb-16 sm:px-6 sm:pb-20">
          <div className="min-w-0 flex-[1_1_440px] animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-[40px] leading-[1.02] font-bold tracking-[-0.025em] text-balance sm:text-[58px]">
              A agenda da sua barbearia, aberta 24 horas.
            </h1>
            <p className="mt-5 max-w-[500px] text-lg text-muted-foreground">
              Seus clientes escolhem serviço, barbeiro e horário numa página com a sua marca. Você
              acompanha tudo, inclusive o faturamento, do celular.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link
                to="/auth"
                search={{ cadastro: 1 }}
                className="press flex h-13 items-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground"
              >
                Criar minha barbearia
              </Link>
              <a
                href="#exemplos"
                className="press flex h-13 items-center rounded-2xl border border-border-strong px-5 text-base font-semibold"
              >
                Ver exemplos de página
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {CHECKS.map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" strokeWidth={2.6} aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-[0_1_360px] justify-center animate-in fade-in slide-in-from-bottom-4 delay-150 duration-700 fill-mode-both">
            <PhoneMockup />
          </div>
        </section>

        {/* Recursos */}
        <section className="border-y border-border bg-band">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3 sm:px-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-[22px]" aria-hidden />
                </span>
                <h2 className="mt-4 text-[21px] leading-tight font-bold">{title}</h2>
                <p className="mt-1.5 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-4 px-5 py-20 sm:px-6">
          <h2 className={H2}>Como funciona</h2>
          <p className="mt-2.5 text-[17px] text-muted-foreground">
            Três passos, e a agenda passa a se encher sozinha.
          </p>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            <Step
              title="Cadastre serviços e barbeiros"
              text="Preço, duração e os horários de cada um."
              visual={
                <div className="flex w-full flex-col gap-2 self-stretch p-3.5">
                  {[
                    ["Corte", "R$ 45"],
                    ["Corte + barba", "R$ 70"],
                    ["Barba", "R$ 35"],
                  ].map(([n, p]) => (
                    <div
                      key={n}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px]"
                    >
                      <span className="font-semibold">{n}</span>
                      <span className="display-num font-semibold">{p}</span>
                    </div>
                  ))}
                </div>
              }
            />
            <Step
              title="Divulgue seu link"
              text="No Instagram, no WhatsApp ou com o QR code no balcão."
              visual={
                <div className="flex items-center gap-4">
                  <QrIllustration />
                  <span className="max-w-[110px] text-[13px] text-muted-foreground">
                    cortesy.com.br/
                    <br />
                    <strong className="text-foreground">sua-barbearia</strong>
                  </span>
                </div>
              }
            />
            <Step
              title="O cliente agenda"
              text="E o horário aparece na sua agenda na hora."
              visual={
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-[18px]" strokeWidth={2.8} aria-hidden />
                  </span>
                  <span className="text-[13px]">
                    <strong>Agendamento confirmado</strong>
                    <br />
                    <span className="text-muted-foreground">Qui, 26 nov · 15:30</span>
                  </span>
                </div>
              }
            />
          </div>
        </section>

        {/* Vitrine */}
        <section id="exemplos" className="scroll-mt-4 border-y border-border bg-band">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
            <h2 className={H2}>Cada barbearia com a sua cara</h2>
            <p className="mt-2.5 text-[17px] text-muted-foreground">
              Escolha o ícone, o banner e as cores, ou envie o seu logo e uma foto.
            </p>
            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {EXAMPLES.map((shop) => (
                <div
                  key={shop.name}
                  className="overflow-hidden rounded-[20px] border border-border bg-card transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="h-[110px]" style={{ background: bannerBackground(shop) }} />
                  <div className="px-[18px] pb-5">
                    <span className="relative z-10 -mt-[30px] inline-block rounded-[18px] border-[3px] border-card">
                      <ShopIcon look={shop} size={56} />
                    </span>
                    <p className="font-display mt-2 text-[22px] leading-tight font-bold [font-stretch:85%]">
                      {shop.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{shop.place}</p>
                    <div className="mt-3.5 flex gap-1.5">
                      {shop.slots.map((h) => (
                        <span
                          key={h}
                          className="display-num flex h-[34px] items-center rounded-lg border border-border px-3 text-sm font-semibold"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground">Barbearias de exemplo.</p>
          </div>
        </section>

        {/* Perguntas */}
        <section id="perguntas" className="mx-auto max-w-3xl scroll-mt-4 px-5 py-20 sm:px-6">
          <h2 className={H2}>Perguntas frequentes</h2>
          <div className="mt-7 border-t border-border">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group border-b border-border">
                <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown
                    className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mb-5 max-w-[640px] text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section id="contato" className="mx-auto max-w-6xl scroll-mt-4 px-5 pb-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-7 rounded-[28px] bg-hero px-6 py-10 text-white sm:px-10 sm:py-12">
            <div className="flex-[1_1_380px]">
              <h2 className="text-[34px] leading-[1.05] font-bold [font-stretch:85%] sm:text-[40px]">
                Fale com a gente
              </h2>
              <p className="mt-2.5 max-w-[460px] text-white/85">
                Dúvidas, ajuda para configurar sua barbearia ou sugestões.
              </p>
              <p className="mt-4 text-lg font-semibold break-all sm:text-xl">{CONTACT_EMAIL}</p>
            </div>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Contato pelo site Cortesy")}`}
                className="press inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-semibold text-[#12485a]"
              >
                <Mail className="size-4" aria-hidden /> Enviar email
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(CONTACT_EMAIL);
                    toast.success("Email copiado.");
                  } catch {
                    toast.error("Não foi possível copiar. Anote o endereço acima.");
                  }
                }}
                className="press inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/45 px-6 font-semibold"
              >
                <Copy className="size-4" aria-hidden /> Copiar endereço
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Cortesy · agendamento online para barbearias</span>
        <a href={`mailto:${CONTACT_EMAIL}`} className="flex h-11 items-center font-medium text-primary sm:h-auto">
          {CONTACT_EMAIL}
        </a>
      </footer>
    </div>
  );
}

function Step({ title, text, visual }: { title: string; text: string; visual: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-5">
      <div className="flex h-[132px] items-center justify-center rounded-xl bg-band">{visual}</div>
      <h3 className="mt-[18px] text-[19px] font-bold">{title}</h3>
      <p className="mt-1 text-[15px] text-muted-foreground">{text}</p>
    </div>
  );
}

function QrIllustration() {
  return (
    <svg
      width="84"
      height="84"
      viewBox="0 0 21 21"
      role="img"
      aria-label="QR code de exemplo"
      className="rounded-lg bg-white p-1.5"
    >
      <path
        fill="#15191b"
        d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2zM8 0h2v2H8zM11 1h2v3h-2zM8 3h2v2H8zM9 6h3v2H9zM8 9h4v2H8zM13 8h2v3h-2zM16 8h5v2h-5zM0 8h3v2H0zM4 9h3v3H4zM14 12h3v2h-3zM18 11h3v3h-3zM9 12h3v3H9zM8 16h2v5H8zM11 17h4v2h-4zM16 15h2v3h-2zM19 16h2v5h-2zM12 19h3v2h-3z"
      />
    </svg>
  );
}

/** Celular ilustrando a página de agendamento (feito em código, acompanha o tema). */
function PhoneMockup() {
  const days = [
    ["Hoje", "24"],
    ["Qua", "25"],
    ["Qui", "26"],
    ["Sex", "27"],
    ["Sáb", "28"],
  ];
  const slots = ["09:00", "09:45", "10:30", "11:15", "13:00", "14:15", "15:30", "16:15"];
  const look: PageLook = EXAMPLES[0]!;
  return (
    <div className="relative pb-5" aria-hidden>
      <div className="w-[300px] rounded-[44px] bg-[#15191b] p-2.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)] dark:bg-[#2a3438]">
        <div className="h-[590px] overflow-hidden rounded-[35px] bg-background">
          <div className="h-[104px]" style={{ background: bannerBackground(look) }} />
          <div className="px-4">
            <span className="relative z-10 -mt-[29px] inline-block rounded-[17px] border-[3px] border-background">
              <ShopIcon look={{ ...look, page_icon: "scissors" }} size={52} />
            </span>
            <p className="font-display mt-1 text-[21px] leading-tight font-bold [font-stretch:85%]">
              {look.name}
            </p>
            <p className="text-xs text-muted-foreground">Asa Norte, Brasília</p>
            <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Serviço</p>
              <p className="text-[13px] font-semibold">Corte + barba · R$ 70</p>
            </div>
            <p className="mt-3.5 mb-1.5 text-[13px] font-semibold">Data</p>
            <div className="flex gap-1.5">
              {days.map(([wd, n], i) => (
                <span
                  key={n}
                  className={cn(
                    "flex h-[50px] flex-1 flex-col items-center justify-center rounded-[11px] border text-[10px]",
                    i === 2 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  {wd}
                  <span className="display-num text-[17px] leading-none font-bold">{n}</span>
                </span>
              ))}
            </div>
            <p className="mt-3.5 mb-1.5 text-[13px] font-semibold">Horário</p>
            <div className="grid grid-cols-4 gap-1.5">
              {slots.map((s) => (
                <span
                  key={s}
                  className={cn(
                    "display-num flex h-9 items-center justify-center rounded-[9px] border text-sm font-semibold",
                    s === "15:30" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-3.5 flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
              Confirmar 15:30
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 -left-5 w-[230px] rounded-2xl bg-hero px-3.5 py-3 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)] sm:-left-10">
        <p className="text-[11px] text-white/85">Para você · próximo cliente</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="display-num text-[28px] leading-none font-bold">14:15</span>
          <span className="text-[13px] font-semibold whitespace-nowrap">Corte + barba</span>
        </p>
      </div>
    </div>
  );
}
