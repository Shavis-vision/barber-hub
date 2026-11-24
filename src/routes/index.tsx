import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Clock, Copy, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Endereço que recebe mensagens (Email Routing do Cloudflare).
const CONTACT_EMAIL = "atendimento@cortesy.com.br";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cortesy — Agendamento online para barbearias" },
      {
        name: "description",
        content:
          "Sua barbearia com agenda organizada e página de agendamento própria. Cadastre serviços, barbeiros e horários em minutos.",
      },
      { property: "og:title", content: "Cortesy — Agendamento online para barbearias" },
      {
        property: "og:description",
        content: "Agenda organizada e página de agendamento própria para sua barbearia.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8 rounded-[9px]" />
          <span className="font-display text-xl font-bold [font-stretch:85%]">Cortesy</span>
        </span>
        <nav className="flex items-center gap-1">
          <a
            href="#contato"
            className="hidden h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex"
          >
            Contato
          </a>
          <Link to="/auth">
            <Button variant="ghost" className="h-11">
              Entrar
            </Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-5">
        <section className="py-14 sm:py-24">
          <p className="label-caps">Agendamento para barbearias</p>
          <h1 className="mt-4 max-w-2xl text-3xl leading-tight font-semibold sm:text-5xl">
            Sua agenda organizada e seus clientes marcando sozinhos.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Cadastre serviços, barbeiros e horários de funcionamento. Sua barbearia ganha uma página
            própria onde o cliente escolhe o horário em poucos toques.
          </p>
          <div className="mt-8">
            <Link to="/auth">
              <Button className="h-12 px-7 text-[15px]">Criar minha barbearia</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {[
            {
              icon: CalendarCheck,
              title: "Agenda por dia e semana",
              text: "Veja horário, cliente, serviço e barbeiro sem poluição visual.",
            },
            {
              icon: Clock,
              title: "Horários reais",
              text: "Só aparece o que está livre, considerando duração e turnos.",
            },
            {
              icon: ShieldCheck,
              title: "Sem horário duplicado",
              text: "Dois clientes nunca reservam o mesmo horário com o mesmo barbeiro.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-card p-6">
              <Icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-4 text-base font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <section
          id="contato"
          className="mt-16 scroll-mt-6 rounded-3xl bg-hero px-6 py-10 text-white sm:px-10 sm:py-12"
        >
          <h2 className="text-3xl leading-tight font-bold sm:text-4xl">Fale com a gente</h2>
          <p className="mt-3 max-w-lg text-base text-white/85">
            Dúvidas, ajuda para configurar sua barbearia ou sugestões. Respondemos por email em
            dias úteis.
          </p>
          <p className="mt-6 text-lg font-semibold break-all sm:text-xl">{CONTACT_EMAIL}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Contato pelo site Cortesy")}`}
              className="press inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-[#12485a]"
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
              className="press inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/45 px-6 text-[15px] font-semibold"
            >
              <Copy className="size-4" aria-hidden /> Copiar endereço
            </button>
          </div>
        </section>

        <footer className="mt-16 flex flex-col gap-2 border-t border-border py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Cortesy · agendamento online para barbearias</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="flex h-11 items-center font-medium text-primary sm:h-auto">
            {CONTACT_EMAIL}
          </a>
        </footer>
      </main>
    </div>
  );
}
