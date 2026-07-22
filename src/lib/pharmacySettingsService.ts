import { supabase } from "./supabaseClient";

// ==================== Pharmacy Settings ====================
export const getPharmacySettings = async (pharmacyId) => {
  try {
    const { data } = await supabase
      .from("pharmacy_settings")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .single();
    return data || {};
  } catch {
    return {};
  }
};
