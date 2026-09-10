import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Navalha" },
      {
        name: "description",
        content:
          "Acesse o painel da sua barbearia ou crie sua conta gratuita para começar a receber agendamentos online.",
      },
      { property: "og:title", content: "Entrar — Navalha" },
      {
        property: "og:description",
        content: "Acesse o painel da sua barbearia ou crie sua conta gratuita.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/dashboard" });
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { shop_name: shopName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent("confirm");
          return;
        }
        router.navigate({ to: "/dashboard" });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent("reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/dashboard" });
  }

  if (sent) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">
          {sent === "confirm" ? "Confirme seu e-mail" : "Verifique seu e-mail"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sent === "confirm"
            ? `Enviamos um link de confirmação para ${email}. Clique nele para ativar sua conta e acessar o painel.`
            : `Enviamos um link para ${email} para você criar uma nova senha.`}
        </p>
        <Button
          variant="outline"
          className="mt-6 h-11 w-full"
          onClick={() => {
            setSent(null);
            setMode("login");
          }}
        >
          Voltar para o login
        </Button>
      </Centered>
    );
  }

  return (
    <Centered>
      <Link to="/" className="label-caps">
        Navalha
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">
        {mode === "login" && "Entrar no painel"}
        {mode === "signup" && "Criar sua barbearia"}
        {mode === "forgot" && "Recuperar senha"}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {mode === "login" && "Acesse a agenda e os agendamentos da sua barbearia."}
        {mode === "signup" && "Leva menos de um minuto. Sem cartão de crédito."}
        {mode === "forgot" && "Informe seu e-mail e enviaremos um link para redefinir a senha."}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="shop">Nome da barbearia</Label>
            <Input
              id="shop"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Barbearia Navalha"
              required
              className="h-11"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            required
            className="h-11"
          />
        </div>

        {mode !== "forgot" && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              minLength={6}
              required
              className="h-11"
            />
          </div>
        )}

        <Button type="submit" disabled={loading} className="h-12 w-full text-[15px]">
          {loading
            ? "Aguarde…"
            : mode === "login"
              ? "Entrar"
              : mode === "signup"
                ? "Criar conta"
                : "Enviar link"}
        </Button>
      </form>

      {mode !== "forgot" && (
        <>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="h-11 w-full" onClick={google}>
            Continuar com Google
          </Button>
        </>
      )}

      <div className="mt-6 space-y-2 text-center text-sm">
        {mode === "login" && (
          <>
            <button className="text-muted-foreground underline" onClick={() => setMode("forgot")}>
              Esqueci minha senha
            </button>
            <p className="text-muted-foreground">
              Ainda não tem conta?{" "}
              <button className="font-medium text-primary" onClick={() => setMode("signup")}>
                Criar barbearia
              </button>
            </p>
          </>
        )}
        {mode !== "login" && (
          <button className="text-muted-foreground underline" onClick={() => setMode("login")}>
            Voltar para o login
          </button>
        )}
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
