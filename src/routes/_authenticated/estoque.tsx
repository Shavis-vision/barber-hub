import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ImageUp,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { money, parseMoney } from "@/lib/format";
import { isLowStock, useProducts, type Product } from "@/lib/products";
import { useMyShop } from "@/lib/shop";
import { shrinkImage } from "@/lib/shop-page";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Cortesy" },
      {
        name: "description",
        content: "Controle os produtos da barbearia e veja o que está acabando.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["owner"]}>
      <StockPage />
    </RoleGate>
  ),
});

const BUCKET = "shop-media";

function storagePath(url: string | null) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

function StockPage() {
  const { data: shop } = useMyShop();
  const { data: products, isLoading } = useProducts(shop?.id);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const lowCount = (products ?? []).filter(isLowStock).length;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products ?? []).filter(
      (p) => (!onlyLow || isLowStock(p)) && (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, query, onlyLow]);

  async function adjust(p: Product, delta: number) {
    const next = Math.max(0, p.quantity + delta);
    if (next === p.quantity) return;
    const key = ["products", shop?.id];
    const before = queryClient.getQueryData<Product[]>(key);
    queryClient.setQueryData<Product[]>(key, (old) =>
      old?.map((x) => (x.id === p.id ? { ...x, quantity: next } : x)),
    );
    const { error } = await supabase.from("products").update({ quantity: next }).eq("id", p.id);
    if (error) {
      queryClient.setQueryData(key, before);
      toast.error("Não foi possível atualizar a quantidade.");
    }
  }

  return (
    <AppShell
      title="Estoque"
      description="Produtos da barbearia e o que está acabando"
      action={
        <Button className="h-11 px-4" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> Produto
        </Button>
      }
    >
      {lowCount > 0 && (
        <button
          type="button"
          onClick={() => setOnlyLow((v) => !v)}
          aria-pressed={onlyLow}
          className={cn(
            "press mb-4 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left",
            onlyLow ? "border-warning bg-warning/15" : "border-warning/50 bg-warning/10",
          )}
        >
          <TriangleAlert
            className="size-5 shrink-0 text-warning-foreground dark:text-warning"
            aria-hidden
          />
          <span className="flex-1 text-[15px]">
            <strong>
              {lowCount} {lowCount === 1 ? "produto acabando" : "produtos acabando"}
            </strong>
            <span className="block text-[13px] text-muted-foreground">
              {onlyLow ? "Mostrando só esses. Toque para ver todos." : "Toque para ver só esses."}
            </span>
          </span>
        </button>
      )}

      {(products?.length ?? 0) > 0 && (
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Buscar produto"
            placeholder="Buscar produto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10 text-base"
          />
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (products?.length ?? 0) === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Package className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold">Nenhum produto ainda</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Cadastre pomadas, cremes e o que mais você guarda na barbearia para saber quando repor.
          </p>
          <Button className="mt-5 h-11 px-5" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> Cadastrar produto
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado.
        </p>
      ) : (
        <ul className="panel divide-y divide-border">
          {list.map((p) => {
            const low = isLowStock(p);
            return (
              <li key={p.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`Editar ${p.name}`}
                >
                  <Thumb url={p.photo_url} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 leading-snug font-semibold break-words">{p.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                      {p.price_cents > 0 && <span>{money(p.price_cents)}</span>}
                      {low && (
                        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning-foreground dark:text-warning">
                          Estoque baixo
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <div
                  className="flex shrink-0 items-center gap-1"
                  role="group"
                  aria-label={`Quantidade de ${p.name}`}
                >
                  <button
                    type="button"
                    onClick={() => adjust(p, -1)}
                    disabled={p.quantity === 0}
                    aria-label="Tirar 1"
                    className="press flex size-11 items-center justify-center rounded-xl border border-border bg-card disabled:opacity-40"
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span
                    className={cn(
                      "display-num w-10 text-center text-xl font-bold",
                      low && "text-warning-foreground dark:text-warning",
                    )}
                    aria-live="polite"
                  >
                    {p.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjust(p, 1)}
                    aria-label="Colocar 1"
                    className="press flex size-11 items-center justify-center rounded-xl border border-border bg-card"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {shop && (
        <ProductDialog
          shopId={shop.id}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["products", shop.id] })}
        />
      )}
    </AppShell>
  );
}

function Thumb({ url, size = 52 }: { url: string | null; size?: number }) {
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="shrink-0 rounded-xl border border-border object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
      style={{ width: size, height: size }}
    >
      <Package className="size-5" aria-hidden />
    </span>
  );
}

function ProductDialog({
  shopId,
  product,
  onClose,
  onSaved,
}: {
  shopId: string;
  product: Product | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = product !== null;
  const existing = product && product !== "new" ? product : null;
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState("0");
  const [min, setMin] = useState("0");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [busy, setBusy] = useState<"photo" | "save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setPrice(existing?.price_cents ?? 0);
    setQty(String(existing?.quantity ?? 0));
    setMin(String(existing?.min_quantity ?? 0));
    setPhotoUrl(existing?.photo_url ?? null);
    setNewPhoto(null);
  }, [open, existing]);

  useEffect(
    () => () => {
      if (newPhoto) URL.revokeObjectURL(newPhoto.preview);
    },
    [newPhoto],
  );

  const toInt = (v: string) => Math.min(100000, Number(v.replace(/\D/g, "")) || 0);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    try {
      const blob = await shrinkImage(file, "product");
      setNewPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível usar esta imagem.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Dê um nome ao produto.");
      return;
    }
    setBusy("save");
    try {
      let finalPhoto = photoUrl;
      if (newPhoto) {
        const path = `${shopId}/products/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, newPhoto.blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) throw error;
        finalPhoto = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const row = {
        name: name.trim().slice(0, 80),
        price_cents: price,
        quantity: toInt(qty),
        min_quantity: toInt(min),
        photo_url: finalPhoto,
      };
      const { error } = existing
        ? await supabase.from("products").update(row).eq("id", existing.id)
        : await supabase.from("products").insert({ ...row, barbershop_id: shopId });
      if (error) throw error;
      // Apaga a foto antiga se foi trocada ou removida.
      const old =
        existing?.photo_url && existing.photo_url !== finalPhoto
          ? storagePath(existing.photo_url)
          : null;
      if (old) await supabase.storage.from(BUCKET).remove([old]);
      toast.success(existing ? "Produto atualizado." : "Produto cadastrado.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy("delete");
    const { error } = await supabase.from("products").delete().eq("id", existing.id);
    if (error) {
      toast.error("Não foi possível excluir.");
      setBusy(null);
      return;
    }
    const old = storagePath(existing.photo_url);
    if (old) await supabase.storage.from(BUCKET).remove([old]);
    toast.success("Produto excluído.");
    setBusy(null);
    setConfirmDelete(false);
    onSaved();
    onClose();
  }

  const shownPhoto = newPhoto?.preview ?? photoUrl;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{existing ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription className="sr-only">
              Nome, foto, preço e quantidade do produto
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4">
            <Thumb url={shownPhoto} size={80} />
            <div className="flex flex-col items-start gap-1">
              <label className="press relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-primary focus-within:ring-2 focus-within:ring-ring">
                {busy === "photo" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ImageUp className="size-4" aria-hidden />
                )}
                {shownPhoto ? "Trocar foto" : "Adicionar foto"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="absolute size-px opacity-0"
                  disabled={busy !== null}
                  onChange={(e) => {
                    void pick(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {shownPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setNewPhoto(null);
                    setPhotoUrl(null);
                  }}
                  className="h-9 text-sm text-muted-foreground"
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Nome</Label>
            <Input
              id="prod-name"
              className="h-11 text-base"
              maxLength={80}
              placeholder="Ex.: Pomada modeladora"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-price">Preço</Label>
            <Input
              id="prod-price"
              className="h-11 text-base"
              inputMode="numeric"
              value={money(price)}
              onChange={(e) => setPrice(Math.min(100000000, parseMoney(e.target.value)))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-qty">Quantidade</Label>
              <Input
                id="prod-qty"
                className="h-11 text-base"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-min">Estoque mínimo</Label>
              <Input
                id="prod-min"
                className="h-11 text-base"
                inputMode="numeric"
                value={min}
                onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Avisamos quando a quantidade chegar ao estoque mínimo. Use 0 para não avisar.
          </p>

          <DialogFooter className="gap-2 sm:justify-between">
            {existing ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={busy !== null}
              >
                <Trash2 className="size-4" aria-hidden /> Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button className="h-11 px-6" onClick={save} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {existing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto e a foto serão apagados. Isso não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {busy === "delete" ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
