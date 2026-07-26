import { supabase } from "./supabaseClient";
import { buildZatcaChainForInvoice } from "./zatca";

export type QueuedEvent = {
    id: string;
    type: string;
    timestamp: string;
    payload: any;
};

// ── تنفيذ فعلي لكل نوع event على Supabase (زي ما هو تمامًا) ──
async function executeEvent(event: QueuedEvent): Promise<any> {
    switch (event.type) {
        case "SALE_INSERT": {
            let invoice = event.payload.invoice;
            if (event.payload.zatcaInput) {
                try {
                    const zatcaFields = await buildZatcaChainForInvoice({
                        invoiceId: invoice.id,
                        ...event.payload.zatcaInput,
                    });
                    invoice = { ...invoice, ...zatcaFields };
                } catch (zErr) {
                    console.error("zatca chain build failed at insert time:", zErr);
                }
            }
            const { error } = await supabase.from("sales").insert(invoice);
            if (error) throw error;
            return invoice;
        }
        case "SOLD_SERIALS_INSERT": {
            const { error } = await supabase.from("sold_serials").insert(event.payload.rows);
            if (error) throw error;
            break;
        }
        case "SALE_STOCK_BATCH": {
            const { data, error } = await supabase.rpc("apply_stock_movements_batch", {
                p_events: event.payload.events,
            });
            if (error) throw error;
            const failed = (data?.results || []).filter((r: any) => r.status === "error");
            if (failed.length > 0) console.error("apply_stock_movements_batch: some events failed", failed);
            break;
        }
        case "LOYALTY_DELTA": {
            const { error } = await supabase.rpc("apply_loyalty_delta", {
                p_pharmacy_id: event.payload.pharmacy_id,
                p_customer_id: event.payload.customer_id,
                p_delta: event.payload.delta,
                p_type: event.payload.type,
                p_ref_sale_id: event.payload.ref_sale_id,
                p_event_id: event.id,
                p_note: event.payload.note ?? null,
                p_earned_mode: event.payload.earned_mode ?? null,
            });
            if (error) throw error;
            break;
        }
        case "MISSED_SALES_INSERT": {
            const { error } = await supabase.from("missed_sales").insert(event.payload.records);
            if (error) throw error;
            break;
        }
        case "JOKER_UPDATE": {
            const { error } = await supabase.from("joker_pending_items")
                .update({ qty: event.payload.qty }).eq("id", event.payload.id);
            if (error) throw error;
            break;
        }
        case "JOKER_INSERT": {
            const { error } = await supabase.from("joker_pending_items").insert(event.payload.record);
            if (error) throw error;
            break;
        }
        case "DOSE_TEMPLATES_UPDATE": {
            const { error } = await supabase.from("pharmacy_settings")
                .update({ dosage_templates: event.payload.dosage_templates })
                .eq("pharmacy_id", event.payload.pharmacy_id);
            if (error) throw error;
            break;
        }
        case "BARCODE_LINK": {
            const { productId, pharmacyId, newGtin, barcodeRow } = event.payload;
            const { error: updateError } = await supabase.from("products")
                .update({ barcode: newGtin }).eq("id", productId).eq("pharmacy_id", pharmacyId);
            if (updateError) throw updateError;
            if (barcodeRow) {
                const { error: insertError } = await supabase.from("product_barcodes").insert(barcodeRow);
                if (insertError) throw insertError;
            }
            break;
        }
        default:
            console.warn("Unknown offline event type:", event.type);
    }
}

let syncing = false;

// ── مزامنة الأحداث المعلّقة في SQLite (بدل IndexedDB) ──
export async function syncQueue() {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    try {
        const events: QueuedEvent[] = await window.offlineAPI.getPendingEvents();
        events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        for (const event of events) {
            try {
                await executeEvent(event);
                await window.offlineAPI.markSynced([event.id]);
            } catch (err) {
                console.error("sync failed for event", event.id, err);
                break; // بنوقف عند أول فشل للحفاظ على الترتيب، هيتعاد المحاولة في الدورة الجاية
            }
        }
    } finally {
        syncing = false;
    }
}

// ── نقطة الدخول الرئيسية: بديل window.offlineAPI.queueEvent المباشر ──
export async function queueEvent(event: QueuedEvent): Promise<{ synced: boolean; result?: any }> {
    if (navigator.onLine) {
        try {
            const result = await executeEvent(event);
            await window.offlineAPI.persistEvent(event); // نسجلها كـ audit trail حتى بعد نجاحها
            await window.offlineAPI.markSynced([event.id]);
            return { synced: true, result };
        } catch (err) {
            console.error("execute failed, falling back to local queue:", err);
        }
    }
    await window.offlineAPI.persistEvent(event);
    return { synced: false };
}

let initialized = false;
export function initOfflineSync() {
    if (initialized) return;
    initialized = true;
    window.addEventListener("online", () => syncQueue());
    setInterval(() => syncQueue(), 30000);
    syncQueue();
}