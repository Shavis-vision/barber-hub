import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  barbershop_id: string;
  name: string;
  price_cents: number;
  quantity: number;
  min_quantity: number;
  photo_url: string | null;
  updated_at: string;
};

/** Estoque baixo: há um mínimo definido e a quantidade chegou nele (ou abaixo). */
export function isLowStock(p: Pick<Product, "quantity" | "min_quantity">) {
  return p.min_quantity > 0 && p.quantity <= p.min_quantity;
}

export function useProducts(shopId?: string) {
  return useQuery({
    queryKey: ["products", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, barbershop_id, name, price_cents, quantity, min_quantity, photo_url, updated_at",
        )
        .eq("barbershop_id", shopId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}
