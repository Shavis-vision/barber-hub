import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Navalha — Agendamento online para barbearias" },
      {
        name: "description",
        content:
          "Sua barbearia com agenda organizada e página de agendamento própria. Cadastre serviços, barbeiros e horários em minutos.",
      },
      { property: "og:title", content: "Navalha — Agendamento online para barbearias" },
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
        <span className="font-display text-lg font-semibold tracking-tight">Navalha</span>
        <Link to="/auth">
          <Button variant="ghost" className="h-10">
            Entrar
          </Button>
        </Link>
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

        <footer className="py-12 text-sm text-muted-foreground">
          Navalha — plataforma de agendamento para barbearias.
        </footer>
      </main>
    </div>
  );
}
