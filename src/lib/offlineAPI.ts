import { supabase } from "./supabaseClient";

// ═══════════════════════════════════════════════════════════════════════════
// نظام الأوفلاين — طابور عمليات مبني على IndexedDB.
// أي عملية كتابة (بيع، سيريالات، حركة مخزون...) بتتلف على window.offlineAPI.queueEvent
// بدل الكتابة المباشرة على Supabase. لو فيه نت، بتتحاول تتبعت على طول. لو مفيش نت أو
// فشلت المحاولة، بتتخزن محليًا وتتزامن تلقائيًا لما الاتصال يرجع.
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME = "pharmacypro_offline";
const STORE_NAME = "queue";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export type QueuedEvent = {
  id: string;
  type: string;
  timestamp: string;
  payload: any;
};

async function addToQueue(event: QueuedEvent) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeFromQueue(id: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllQueued(): Promise<QueuedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueCount(): Promise<number> {
  const all = await getAllQueued();
  return all.length;
}

// ── تنفيذ فعلي لكل نوع event على Supabase ──
// أضف حالة جديدة هنا (case) لكل نوع عملية جديدة تحب تضيفها لنظام الأوفلاين مستقبلًا
// (مرتجعات، تحصيل آجل، إغلاق شفت...) بنفس الأسلوب.
async function executeEvent(event: QueuedEvent): Promise<void> {
  switch (event.type) {
    case "SALE_INSERT": {
      const { error } = await supabase.from("sales").insert(event.payload.invoice);
      if (error) throw error;
      break;
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
      if (failed.length > 0) {
        // بنعتبرها نجحت من ناحية الاتصال (الطلب وصل ورجع رد)، لكن بنسجلها في الكونسول
        // للمراجعة اليدوية بدل ما نعيد المحاولة لا نهائيًا على حدث فيه مشكلة بيانات حقيقية
        console.error("apply_stock_movements_batch: some events failed", failed);
      }
      break;
    }
    case "MISSED_SALES_INSERT": {
      const { error } = await supabase.from("missed_sales").insert(event.payload.records);
      if (error) throw error;
      break;
    }
    case "JOKER_UPDATE": {
      const { error } = await supabase
        .from("joker_pending_items")
        .update({ qty: event.payload.qty })
        .eq("id", event.payload.id);
      if (error) throw error;
      break;
    }
    case "JOKER_INSERT": {
      // الـ id متولد من العميل مسبقًا (crypto.randomUUID) عشان القايمة المحلية تكون
      // متزامنة فورًا من غير ما نستنى رد السيرفر باللي فيه id مولّد هناك.
      const { error } = await supabase.from("joker_pending_items").insert(event.payload.record);
      if (error) throw error;
      break;
    }
    case "BARCODE_LINK": {
      const { productId, pharmacyId, newGtin, barcodeRow } = event.payload;
      const { error: updateError } = await supabase
        .from("products")
        .update({ barcode: newGtin })
        .eq("id", productId)
        .eq("pharmacy_id", pharmacyId);
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
let listeners: Array<(count: number) => void> = [];

export function onQueueChange(cb: (count: number) => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

async function notifyListeners() {
  const count = await getQueueCount();
  listeners.forEach((l) => l(count));
}

export async function syncQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const events = await getAllQueued();
    // بالترتيب الزمني عشان الفاتورة تتسجل في السيرفر قبل السيريالات وحركة المخزون بتاعتها
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const event of events) {
      try {
        await executeEvent(event);
        await removeFromQueue(event.id);
        await notifyListeners();
      } catch (err) {
        console.error("sync failed for event", event.id, err);
        // نوقف عند أول فشل عشان نحافظ على الترتيب (فاتورة قبل سيريالات قبل مخزون)،
        // وهيتعاد المحاولة في الدورة الجاية (لما "online" يتفعّل تاني أو كل 30 ثانية)
        break;
      }
    }
  } finally {
    syncing = false;
  }
}

// ── نقطة الدخول الرئيسية: أي كود في التطبيق ينده عليها بدل الكتابة المباشرة على Supabase ──
async function queueEvent(event: QueuedEvent): Promise<{ synced: boolean }> {
  if (navigator.onLine) {
    try {
      await executeEvent(event);
      return { synced: true };
    } catch (err) {
      // فشل رغم إن navigator.onLine بيقول متصل (نت ضعيف/متقطع أثناء الإرسال نفسه) →
      // منسيبش العملية تضيع، بنخزنها كـ fallback
    }
  }
  await addToQueue(event);
  await notifyListeners();
  return { synced: false };
}

let initialized = false;
export function initOfflineAPI() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("online", () => {
    syncQueue();
  });
  // محاولة دورية تحسبًا لأي حدث "online" اتفوت (بعض الأجهزة/المتصفحات مش دايمًا بتطلقه)
  setInterval(() => {
    syncQueue();
  }, 30000);
  // محاولة أولى عند تحميل التطبيق (لو فيه عمليات متراكمة من جلسة سابقة)
  syncQueue();

  (window as any).offlineAPI = { queueEvent, getQueueCount, onQueueChange, syncQueue };
}
