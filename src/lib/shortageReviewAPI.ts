import { supabase } from "./supabaseClient"; // adjust path to your existing client

export interface ZeroStockProduct {
  id: string;
  name: string;
  name_en: string | null;
  auto_order: boolean;
  shortage_reviewed_at: string | null;
}

/** Every product currently at zero total stock (sum of batches[].qty). */
export async function getZeroStockProducts(pharmacyId: string): Promise<ZeroStockProduct[]> {
  const { data, error } = await supabase.rpc("get_zero_stock_products", {
    p_pharmacy_id: pharmacyId,
  });
  if (error) throw error;
  return data ?? [];
}

/** Toggle a single product's purchase-request visibility; marks it reviewed. */
export async function setProductAutoOrder(productId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ auto_order: value, shortage_reviewed_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
}

/**
 * Bulk hide/show every product currently at zero stock. Returns the
 * number of rows affected. Safe to call more than once — only
 * touches whatever is still at zero stock at the time it runs.
 */
export async function bulkSetAutoOrderForZeroStock(pharmacyId: string, value: boolean): Promise<number> {
  const { data, error } = await supabase.rpc("bulk_set_auto_order_zero_stock", {
    p_pharmacy_id: pharmacyId,
    p_value: value,
  });
  if (error) throw error;
  return data as number;
}
