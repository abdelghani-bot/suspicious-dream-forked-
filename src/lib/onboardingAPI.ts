import { supabase } from "./supabaseClient"; // adjust path to your existing client

export type StepStatus = "pending" | "in_progress" | "done";

export interface OnboardingStepRow {
  id: string;
  pharmacy_id: string;
  step_key: string;
  status: StepStatus;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
}

/**
 * Fetch onboarding steps for the current pharmacy.
 * Onboarding is a one-time, admin-driven setup flow that happens
 * while the pharmacy is online (Rasd/GLN registration already
 * requires internet), so this intentionally goes straight to
 * Supabase rather than through the offline event queue used
 * elsewhere in the app.
 */
export async function getOnboardingSteps(pharmacyId: string): Promise<OnboardingStepRow[]> {
  const { data, error } = await supabase
    .from("pharmacy_onboarding_steps")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Mark a step done/in-progress/pending. Called from the CTA
 * button once the underlying screen confirms the step is actually
 * satisfied (e.g. treasury opening balance saved successfully).
 */
export async function updateOnboardingStep(
  pharmacyId: string,
  stepKey: string,
  status: StepStatus,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from("pharmacy_onboarding_steps")
    .update({
      status,
      completed_by: status === "done" ? userId ?? null : null,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("pharmacy_id", pharmacyId)
    .eq("step_key", stepKey);

  if (error) throw error;
}

/**
 * Cross-check real data against pharmacy_onboarding_auto_status
 * and auto-flip steps to 'done' where the underlying condition
 * is already satisfied (e.g. an opening treasury entry exists),
 * without requiring the user to manually confirm.
 * Call this once when the onboarding screen mounts.
 */
export async function syncAutoDetectedSteps(pharmacyId: string): Promise<void> {
  const { data, error } = await supabase
    .from("pharmacy_onboarding_auto_status")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .single();

  if (error || !data) return;

  const autoMap: Record<string, boolean> = {
    treasury: data.treasury_ready,
    suppliers: data.suppliers_ready,
    inventory: data.inventory_ready,
  };

  await Promise.all(
    Object.entries(autoMap)
      .filter(([, ready]) => ready)
      .map(([stepKey]) =>
        updateOnboardingStep(pharmacyId, stepKey, "done").catch(() => {
          /* non-fatal — leave as manual if this fails */
        })
      )
  );
}

/** Call once, right after a new pharmacy row is inserted. */
export async function seedOnboardingSteps(pharmacyId: string): Promise<void> {
  const { error } = await supabase.rpc("seed_onboarding_steps", {
    p_pharmacy_id: pharmacyId,
  });
  if (error) throw error;
}

/**
 * True once every onboarding step is 'done'. Use this to hide the
 * "إعداد الصيدلية" sidebar item once setup is finished — cheap
 * enough to call on app load / sidebar render since it's a single
 * indexed query, not a full row fetch.
 */
export async function isOnboardingComplete(pharmacyId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("pharmacy_onboarding_steps")
    .select("*", { count: "exact", head: true })
    .eq("pharmacy_id", pharmacyId)
    .neq("status", "done");

  if (error) {
    console.error(error);
    return false; // fail safe: keep the item visible if the check fails
  }
  return count === 0;
}
