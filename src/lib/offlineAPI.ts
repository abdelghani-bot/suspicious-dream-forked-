import { supabase } from "./supabaseClient";
import { buildZatcaChainForInvoice } from "./zatca";
import { authService } from "../services/authService"; // 🆕 عدّل المسار حسب مكان الملف الفعلي عندك
import { calcCappedHours } from "./dateUtils";
import { getDeviceId } from "./deviceID";

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
        case "PURCHASE_INSERT": {
            const { error } = await supabase.from("purchases").insert(event.payload.invoice);
            if (error) throw error;
            break;
        }
        case "PURCHASE_STOCK_ADD": {
            const { data, error } = await supabase.rpc("apply_purchase_stock_batch", {
                p_events: event.payload.events,
            });
            if (error) throw error;
            const failed = (data?.results || []).filter((r: any) => r.status === "error");
            if (failed.length > 0) console.error("apply_purchase_stock_batch: some events failed", failed);
            break;
        }
        case "VARIANCE_LOG_INSERT": {
            const { error } = await supabase.from("inventory_variance_log").insert(event.payload.row);
            if (error) throw error;
            break;
        }
        case "INVENTORY_COUNT_SAVE": {
            const { logData, adjustments, productUpdates, resolveVariance } = event.payload;

            const { error: logErr } = await supabase.from("inventory_logs").insert(logData);
            if (logErr) throw logErr;

            if (adjustments && adjustments.length > 0) {
                const { error: adjErr } = await supabase.from("inventory_adjustments").insert(adjustments);
                if (adjErr) throw adjErr;
            }

            for (const u of productUpdates) {
                const { error } = await supabase
                    .from("products")
                    .update({ stock: u.stock, batches: u.batches })
                    .eq("id", u.id)
                    .eq("pharmacy_id", u.pharmacy_id);
                if (error) throw error;
            }

            if (resolveVariance && resolveVariance.length > 0) {
                for (const r of resolveVariance) {
                    const { error: varErr } = await supabase
                        .from("inventory_variance_log")
                        .update({
                            status: "resolved",
                            resolved_by: r.resolvedBy || null,
                            resolved_at: new Date().toISOString(),
                            resolution_notes: r.resolutionNotes || null,
                        })
                        .eq("pharmacy_id", event.pharmacy_id)
                        .eq("product_id", r.productId)
                        .eq("status", "pending");
                    if (varErr) console.error("resolveVariance in INVENTORY_COUNT_SAVE failed:", varErr);
                }
            }
            break;
        }

        // ==================== الشفتات ====================
        case "SHIFT_OPEN": {
            const { error } = await supabase.from("shifts").insert(event.payload.shift);
            if (error) throw error;
            break;
        }
        case "SHIFT_CLOSE": {
            const { error } = await supabase.from("shifts")
                .update(event.payload.updates).eq("id", event.payload.shiftId);
            if (error) throw error;
            break;
        }
        case "ATTENDANCE_CHECKIN": {
            // نفس شرط "مفيش سجل مفتوح" لكن بيتحقق وقت الـ sync (أونلاين فعلاً) مش وقت الفتح أوفلاين
            const existing = await supabase.from("attendance_logs").select("id")
                .eq("pharmacy_id", event.payload.pharmacy_id)
                .eq("pharmacist_name", event.payload.pharmacist_name)
                .eq("date", event.payload.date).is("check_out", null).maybeSingle();
            if (!existing.data) {
                const { error } = await supabase.from("attendance_logs").insert(event.payload.record);
                if (error) throw error;
            }
            break;
        }
        case "ATTENDANCE_CHECKOUT": {
            // 🆕 حساب الساعات بيتأجل هنا (وقت النت الفعلي) بدل وقت إغلاق الشفت أوفلاين
            const { pharmacy_id, pharmacist_name, date, check_out } = event.payload;
            const { data: openLog } = await supabase.from("attendance_logs").select("*")
                .eq("pharmacy_id", pharmacy_id).eq("pharmacist_name", pharmacist_name)
                .eq("date", date).is("check_out", null).maybeSingle();
            if (!openLog) break; // اتقفل فعلاً (مثلاً sync اتكرر)

            const { data: schedRows } = await supabase.from("work_schedules").select("*")
                .eq("pharmacy_id", pharmacy_id).eq("pharmacist_name", pharmacist_name)
                .eq("day_of_week", new Date(openLog.check_in).getDay())
                .eq("shift_number", openLog.shift_number || 1).eq("is_off", false).maybeSingle();
            const { data: breaks } = await supabase.from("prayer_breaks")
                .select("deducted_minutes").eq("attendance_id", openLog.id);

            const { totalHours } = calcCappedHours(openLog.check_in, check_out, schedRows);
            const totalDeductions = (breaks || []).reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0) / 60;
            const netHours = Math.max(0, totalHours - totalDeductions);

            const { error } = await supabase.from("attendance_logs").update({
                check_out, total_hours: +totalHours.toFixed(2),
                total_deductions: +totalDeductions.toFixed(2), net_hours: +netHours.toFixed(2),
            }).eq("id", openLog.id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }

        // ==================== موديول الحضور — الانصراف اليدوي واستراحات الصلاة والإعدادات ====================
        // 🆕 انصراف يدوي (زرار "انصراف" في تاب الحضور، مش مرتبط بقفل شفت) — الساعات هنا محسوبة
        // بالفعل في الموديول وقت الضغط (باستخدام workSchedules/prayerBreaks المحمّلين مسبقًا)،
        // فبنكتب updates جاهزة على عكس ATTENDANCE_CHECKOUT اللي بيأجّل الحساب لوقت المزامنة.
        case "ATTENDANCE_LOG_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("attendance_logs")
                .update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "PRAYER_BREAK_INSERT": {
            const { error } = await supabase.from("prayer_breaks").insert(event.payload.record);
            if (error) throw error;
            break;
        }
        case "PRAYER_SETTING_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("prayer_settings")
                .update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        // 🆕 استبدال جدول الأسبوع بالكامل لصيدلي معين (عادي أو نسخة رمضان) — حذف القديم
        // بنفس الفلتر (pharmacy_id + pharmacist_name + is_ramadan) ثم إدراج الصفوف الجديدة،
        // كلها جوه event واحد عشان لو النت اتقطع منتفضلش بحذف من غير إدراج.
        case "WORK_SCHEDULE_REPLACE_WEEK": {
            const { pharmacy_id, pharmacist_name, is_ramadan, rows } = event.payload;
            const { error: delError } = await supabase.from("work_schedules").delete()
                .eq("pharmacy_id", pharmacy_id).eq("pharmacist_name", pharmacist_name).eq("is_ramadan", is_ramadan);
            if (delError) throw delError;
            if (rows && rows.length > 0) {
                const { error: insError } = await supabase.from("work_schedules").insert(rows);
                if (insError) throw insError;
            }
            break;
        }
        case "WORK_SCHEDULE_UPSERT": {
            const { error } = await supabase.from("work_schedules")
                .upsert(event.payload.row, { onConflict: "pharmacy_id,pharmacist_name,day_of_week,shift_number" });
            if (error) throw error;
            break;
        }
        case "WORK_SCHEDULE_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("work_schedules").delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "HOLIDAY_INSERT": {
            const { error } = await supabase.from("official_holidays").insert(event.payload.row);
            if (error) throw error;
            break;
        }
        case "HOLIDAY_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("official_holidays").update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "HOLIDAY_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("official_holidays").delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "ROTATION_INSERT": {
            const { error } = await supabase.from("rotation_schedules").insert(event.payload.row);
            if (error) throw error;
            break;
        }
        case "ROTATION_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("rotation_schedules").update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "ROTATION_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("rotation_schedules").delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "GAP_REASON_INSERT": {
            const { error } = await supabase.from("attendance_gaps").insert(event.payload.record);
            if (error) throw error;
            break;
        }
        // 🆕 مراجعة فجوة الحضور المشبوهة — لو اتـ"رفضت"، الخصم من late_minutes/net_hours
        // بيتحسب هنا وقت المزامنة على بيانات attendance_logs الطازة (نفس فلسفة ATTENDANCE_CHECKOUT)
        // بدل قيمة مطلقة محسوبة أوفلاين، عشان نتفادى overwrite لو حصل تعديل تاني على نفس السجل.
        case "GAP_REVIEW": {
            const { gapId, approve, reviewedBy, reviewedAt, attendanceId, durationMinutes, pharmacyId } = event.payload;
            const { error: gapErr } = await supabase.from("attendance_gaps").update({
                review_status: approve ? "approved" : "rejected",
                reviewed_at: reviewedAt, reviewed_by: reviewedBy,
            }).eq("id", gapId);
            if (gapErr) throw gapErr;

            if (!approve && attendanceId) {
                const { data: log } = await supabase.from("attendance_logs").select("*").eq("id", attendanceId).single();
                if (log) {
                    const currentLate = +log.late_minutes || 0;
                    const currentNet = log.net_hours != null ? +log.net_hours : null;
                    const { error: logErr } = await supabase.from("attendance_logs").update({
                        late_minutes: currentLate + durationMinutes,
                        net_hours: currentNet != null ? Math.max(0, currentNet - durationMinutes / 60) : null,
                    }).eq("id", attendanceId).eq("pharmacy_id", pharmacyId);
                    if (logErr) throw logErr;
                }
            }
            break;
        }
        case "GAP_THRESHOLD_UPDATE": {
            const { pharmacy_id, minutes } = event.payload;
            const { error } = await supabase.from("pharmacy_settings")
                .upsert([{ pharmacy_id, attendance_gap_threshold_minutes: minutes }], { onConflict: "pharmacy_id" });
            if (error) throw error;
            break;
        }

        // ==================== الخزنة الموحّدة ====================
        // 🆕 event عام لأي قيد خزنة أياً كان مصدره — sub_type بيميز المصدر
        // (sales_return, purchase_return, supplier_payment, shift_variance, daily_closing, manual_expense...)
        case "TREASURY_ENTRY_INSERT": {
            const { error } = await supabase.from("treasury_entries").insert(event.payload.entry);
            if (error) throw error;
            break;
        }

        // ==================== المرتجعات ====================
        // 🆕 مرتجع (بيع أو شراء) — event مركّب واحد بيتنفذ بالكامل جوه RPC واحدة (apply_return_process)
        // على السيرفر: تحديث المخزون بالـ delta (+/-)، فك السيريالات، تحديث returnedQty في الفاتورة
        // الأصلية (sales أو purchases) بناءً على الحالة الحالية وقت التنفيذ الفعلي (مش قيمة نهائية
        // محسوبة أوفلاين)، وحفظ سجل المرتجع نفسه. ده بيحل مشكلة الـ overwrite لو حصل أكتر من
        // مرتجع/حركة على نفس الصنف أو نفس الفاتورة قبل ما يوصل النت.
        // الجانب المالي (خزنة/مديونية) مفصول بره الحدث ده عمداً — بيتبعت كـ TREASURY_ENTRY_INSERT
        // أو CREDIT_PAYMENT_INSERT منفصلين.
        case "RETURN_PROCESS": {
            const { returnRow, stockDeltas, serialsToRelease, salesReturnItems, purchaseReturnItems } = event.payload;

            const { error } = await supabase.rpc("apply_return_process", {
                p_return_row: returnRow,
                p_stock_deltas: stockDeltas,
                p_serials_to_release: serialsToRelease ?? null,
                p_sales_return_items: salesReturnItems ?? null,
                p_purchase_return_items: purchaseReturnItems ?? null,
            });
            if (error) throw error;
            break;
        }

        case "PURCHASE_INVOICE_EDIT": {
            const { purchaseId, pharmacyId, updates, stockDeltas } = event.payload;

            const { error } = await supabase.from("purchases")
                .update(updates).eq("id", purchaseId).eq("pharmacy_id", pharmacyId);
            if (error) throw error;

            if (stockDeltas && stockDeltas.length > 0) {
                const { error: stockErr } = await supabase.rpc("apply_stock_deltas", {
                    p_deltas: stockDeltas,
                });
                if (stockErr) throw stockErr;
            }
            break;
        }

        // 🆕 خصم مرتجع آجل من مديونية العميل (نفس آلية السداد بالضبط)
        case "CREDIT_PAYMENT_INSERT": {
            const { error } = await supabase.from("credit_payments").insert(event.payload.records);
            if (error) throw error;
            break;
        }

        // ==================== العملاء ====================
        // 🆕 إضافة/تعديل/حذف عميل — نفس نمط الشفت والخزنة بالظبط: كتابة فورية في
        // customers_cache من جوه الموديول + queueEvent هنا بينفذ الكتابة الفعلية على Supabase.
        case "CUSTOMER_INSERT": {
            const { error } = await supabase.from("customers").insert(event.payload.customer);
            if (error) throw error;
            break;
        }
        case "CUSTOMER_UPDATE": {
            const { id, updates, pharmacy_id } = event.payload;
            const { error } = await supabase.from("customers")
                .update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "CUSTOMER_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("customers")
                .delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        // ==================== الموردين ====================
        case "SUPPLIER_INSERT": {
            const { error } = await supabase.from("suppliers").insert(event.payload.supplier);
            if (error) throw error;
            break;
        }
        case "SUPPLIER_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("suppliers")
                .update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "SUPPLIER_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("suppliers")
                .delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "PAYMENT_INSERT": {
            const { error } = await supabase.from("payments").insert(event.payload.payment);
            if (error) throw error;
            break;
        }
        // 🆕 case عامة لأي تحديث على فاتورة شراء واحدة — تُستخدم من FIFO السداد
        // وهنستخدمها كمان في مرحلة المرتجع التلقائي (returned_amount) لاحقًا
        case "PURCHASE_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("purchases")
                .update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        // ==================== الأوردرات + الجوكر ====================
        case "ORDER_INSERT": {
            const { error } = await supabase.from("orders").insert(event.payload.order);
            if (error) throw error;
            break;
        }
        // 🆕 مختلفة عن JOKER_UPDATE الموجودة (اللي بتحدث qty لصنف واحد) —
        // دي لتحديث الـ status لمجموعة أصناف جوكر مع بعض دفعة واحدة
        case "JOKER_STATUS_UPDATE": {
            const { ids, status } = event.payload;
            const { error } = await supabase.from("joker_pending_items")
                .update({ status }).in("id", ids);
            if (error) throw error;
            break;
        }
        case "JOKER_DELETE": {
            const { ids } = event.payload;
            const { error } = await supabase.from("joker_pending_items").delete().in("id", ids);
            if (error) throw error;
            break;
        }
        // 🆕 case عامة لتحديث حقل/حقول على منتج واحد — هنا auto_order، وقابلة لإعادة
        // الاستخدام لأي تحديث حقل واحد تاني على المنتج بدل ما نعمل case جديدة كل مرة
        case "PRODUCT_FIELD_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("products")
                .update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "RETURN_INSERT": {
            const { error } = await supabase.from("returns").insert([event.payload.return]);
            if (error) throw error;
            break;
        }
        // ==================== العروض (Promotions) ====================
        case "PROMOTION_INSERT": {
            const { error } = await supabase.from("promotions").insert(event.payload.rows);
            if (error) throw error;
            break;
        }
        case "PROMOTION_UPDATE": {
            const { id, pharmacy_id, updates } = event.payload;
            const { error } = await supabase.from("promotions")
                .update(updates).eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "PROMOTION_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("promotions")
                .delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        // 🆕 استبدال قواعد الخصم التلقائي — atomic عبر RPC بدل delete+insert منفصلين
        case "PROMO_RULES_REPLACE": {
            const { error } = await supabase.rpc("replace_promo_rules", {
                p_pharmacy_id: event.pharmacy_id,
                p_rows: event.payload.rows,
            });
            if (error) throw error;
            break;
        }
        case "PROMO_PRINT_LOG_INSERT": {
            const { error } = await supabase.from("promo_print_log").insert(event.payload.row);
            if (error) throw error;
            break;
        }
        case "PROMO_SETTINGS_UPSERT": {
            const { error } = await supabase.from("promo_settings")
                .upsert(event.payload.row, { onConflict: "pharmacy_id" });
            if (error) throw error;
            break;
        }

        // ==================== التارجت والتحفيز ====================
        case "MONTHLY_TARGET_UPSERT": {
            const { error } = await supabase.from("monthly_targets")
                .upsert([event.payload.row], { onConflict: "pharmacy_id,pharmacist_name,month" });
            if (error) throw error;
            break;
        }
        case "INCENTIVE_CONFIG_UPSERT": {
            const { error } = await supabase.from("incentive_config")
                .upsert(event.payload.row, { onConflict: "pharmacy_id" });
            if (error) throw error;
            break;
        }
        // 🆕 tier جديد/تعديل + threshold history سوا — atomic عبر RPC
        case "INCENTIVE_TIER_UPSERT": {
            const { tier_id, threshold, rate, created_by } = event.payload;
            const { error } = await supabase.rpc("upsert_incentive_tier", {
                p_pharmacy_id: event.pharmacy_id,
                p_tier_id: tier_id ?? null,
                p_threshold: threshold,
                p_rate: rate,
                p_created_by: created_by ?? null,
            });
            if (error) throw error;
            break;
        }
        case "INCENTIVE_TIER_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("incentive_tiers")
                .delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
        case "INCENTIVE_OVERRIDE_UPSERT": {
            const { error } = await supabase.from("incentive_overrides")
                .upsert(event.payload.row, { onConflict: "pharmacy_id,product_id" });
            if (error) throw error;
            break;
        }
        case "INCENTIVE_OVERRIDE_DELETE": {
            const { id, pharmacy_id } = event.payload;
            const { error } = await supabase.from("incentive_overrides")
                .delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
            if (error) throw error;
            break;
        }
         case "PRODUCT_SAVE": {
    const { product, editing, pharmacy_id } = event.payload;
    if (editing) {
        const { error } = await supabase.from("products")
            .update(product).eq("id", product.id).eq("pharmacy_id", pharmacy_id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from("products")
            .insert({ ...product, pharmacy_id });
        if (error) throw error;
    }
    break;
}
case "PRODUCT_BARCODES_REPLACE": {
    const { productId, rows } = event.payload;
    await supabase.from("product_barcodes").delete().eq("product_id", productId);
    if (rows.length > 0) {
        const { error } = await supabase.from("product_barcodes").insert(rows);
        if (error) throw error;
    }
    break;
}
case "PRODUCT_INGREDIENTS_REPLACE": {
    const { productId, rows } = event.payload;
    await supabase.from("product_ingredients").delete().eq("product_id", productId);
    if (rows.length > 0) {
        const { error } = await supabase.from("product_ingredients").insert(rows);
        if (error) throw error;
    }
    break;
        }
        case "ITEM_TYPE_INSERT": {
            const { error } = await supabase.from("item_types").insert(event.payload.record);
            if (error) throw error;
            break;
        }
        case "SUB_CATEGORY2_INSERT": {
    const { record, pharmacy_id } = event.payload;
    const { error } = await supabase.from("sub_categories2").insert(record);
    if (error) throw error;
    break;
}
case "ITEM_TYPE_DELETE": {
    const { id, pharmacy_id } = event.payload;
    const { error } = await supabase.from("item_types").delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
    if (error) throw error;
    break;
}
case "SUB_CATEGORY2_DELETE": {
    const { id, pharmacy_id } = event.payload;
    const { error } = await supabase.from("sub_categories2").delete().eq("id", id).eq("pharmacy_id", pharmacy_id);
    if (error) throw error;
    break;
}
        case "PHARMACY_SETTINGS_UPDATE": {
            const { error } = await supabase.from("pharmacy_settings")
                .update(event.payload.updates)
                .eq("pharmacy_id", event.payload.pharmacy_id);
            if (error) throw error;
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
        // تأكد من صلاحية الجلسة قبل أي محاولة مزامنة
        let { data: { session } } = await supabase.auth.getSession();

        // 🆕 مش بس نتأكد من وجود الـ session — نتأكد إنها لسه صالحة (أو قريبة من الانتهاء)
        const isExpiredOrExpiringSoon = session?.expires_at
            ? session.expires_at * 1000 < Date.now() + 60_000 // هامش دقيقة
            : false;

        if (session && isExpiredOrExpiringSoon) {
            const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshedData.session) {
                console.warn("syncQueue: session refresh failed, falling back to silent re-auth");
                session = null; // نسقطها عشان تدخل مسار الـ silent re-auth تحت
            } else {
                session = refreshedData.session;
            }
        }

        if (!session) {
            // 🆕 مفيش جلسة Supabase حقيقية — ده متوقع لو المستخدم دخل أوفلاين.
            // نجرب silent re-auth بالـ refresh_token المخزّن قبل ما نأجّل المزامنة
            const pharmacyId = localStorage.getItem("current_pharmacy_id");
            if (!pharmacyId) {
                console.warn("syncQueue: no valid session and no cached pharmacy_id, deferring sync");
                return;
            }

            const reauthed = await authService.attemptSilentReauth(pharmacyId);
            if (!reauthed) {
                console.warn("syncQueue: silent re-auth failed, deferring sync");
                return;
            }

            // نجحت — نجيب الجلسة الجديدة اللي اتعملها setSession جوه attemptSilentReauth
            const refreshed = await supabase.auth.getSession();
            session = refreshed.data.session;
            if (!session) {
                console.warn("syncQueue: re-auth reported success but session still missing, deferring sync");
                return;
            }
            console.log("syncQueue: silent re-auth succeeded, proceeding with sync");
        }

        const events: QueuedEvent[] = await window.offlineAPI.getPendingEvents();
        events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        for (const event of events) {
            try {
                await executeEvent(event);
                await window.offlineAPI.markSynced([event.id]);
            } catch (err) {
                console.error("sync failed for event", event.id, event.type, err);
            }
        }
    } finally {
        syncing = false;
    }
}

// ── نقطة الدخول الرئيسية: بديل window.offlineAPI.queueEvent المباشر ──
export async function queueEvent(event: QueuedEvent): Promise<{ synced: boolean; result?: any; error?: string }> {
    if (navigator.onLine) {
        try {
            const result = await executeEvent(event);
            await window.offlineAPI.persistEvent(event);
            await window.offlineAPI.markSynced([event.id]);
            return { synced: true, result };
        } catch (err) {
            console.error("execute failed, falling back to local queue:", err);
            await window.offlineAPI.persistEvent(event);
            return { synced: false, error: err?.message || String(err) };
        }
    }
    await window.offlineAPI.persistEvent(event);
    return { synced: false };
}

// ==================== العروض ====================
export async function savePromotions(rows: any[], pharmacyId: string) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PROMOTION_INSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { rows },
    });
}

export async function updatePromotion(id: string, pharmacyId: string, updates: any) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PROMOTION_UPDATE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { id, pharmacy_id: pharmacyId, updates },
    });
}

export async function deletePromotion(id: string, pharmacyId: string) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PROMOTION_DELETE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { id, pharmacy_id: pharmacyId },
    });
}

export async function replacePromoRules(pharmacyId: string, rows: any[]) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PROMO_RULES_REPLACE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { rows },
    });
}

export async function logPromoPrint(row: any, pharmacyId: string) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PROMO_PRINT_LOG_INSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { row },
    });
}

export async function savePromoSettings(row: any, pharmacyId: string) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PROMO_SETTINGS_UPSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { row: { ...row, pharmacy_id: pharmacyId } },
    });
}

// ==================== التارجت والتحفيز ====================
export async function upsertMonthlyTarget(row: any, pharmacyId: string) {
    try {
        await window.offlineAPI.upsertMonthlyTargetCache({ pharmacyId, row });
    } catch (err) {
        console.error("upsertMonthlyTargetCache failed:", err);
    }

    return queueEvent({
        id: crypto.randomUUID(),
        type: "MONTHLY_TARGET_UPSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { row },
    });
}

export async function saveIncentiveConfig(row: any, pharmacyId: string) {
    try {
        await window.offlineAPI.upsertIncentiveConfigCache({ pharmacyId, allowedCategories: row.allowed_categories });
    } catch (err) {
        console.error("upsertIncentiveConfigCache failed:", err);
    }

    return queueEvent({
        id: crypto.randomUUID(),
        type: "INCENTIVE_CONFIG_UPSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { row },
    });
}

// 🆕 الـ id بقى مولّد من العميل دايمًا (يطابق الـ RPC المعدّل) بدل ما نستنى id من السيرفر.
// بترجع tierId في النتيجة عشان الكومبوننت يحدّث state بتاعه فورًا (زي ما كان بياخده قبل
// كده من data.id بعد .select().single() في saveTier الأصلية).
export async function upsertIncentiveTier(
    pharmacyId: string, tierId: string | null, threshold: number, rate: number, createdBy?: string
) {
    const finalTierId = tierId || crypto.randomUUID();
    try {
        // نفس شرط الـ RPC بالظبط: نضيف history بس لو tier جديد أو الـ threshold اتغيّر فعليًا
        let oldThreshold: number | null = null;
        if (tierId) {
            const existing = await window.offlineAPI.getIncentiveTiersCache(pharmacyId);
            oldThreshold = (existing || []).find((t: any) => t.id === tierId)?.threshold ?? null;
        }
        await window.offlineAPI.upsertIncentiveTierCache({ id: finalTierId, pharmacyId, threshold, rate });
        if (!tierId || oldThreshold !== threshold) {
            await window.offlineAPI.insertTierThresholdHistoryCache({
                id: crypto.randomUUID(), pharmacyId, tierId: finalTierId,
                threshold, effectiveFrom: new Date().toISOString(),
            });
        }
    } catch (err) {
        console.error("upsertIncentiveTierCache failed:", err);
    }

    const result = await queueEvent({
        id: crypto.randomUUID(),
        type: "INCENTIVE_TIER_UPSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { tier_id: finalTierId, threshold, rate, created_by: createdBy },
    });
    return { ...result, tierId: finalTierId };
}

export async function deleteIncentiveTier(id: string, pharmacyId: string) {
    try {
        await window.offlineAPI.deleteIncentiveTierCache(id);
    } catch (err) {
        console.error("deleteIncentiveTierCache failed:", err);
    }

    return queueEvent({
        id: crypto.randomUUID(),
        type: "INCENTIVE_TIER_DELETE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { id, pharmacy_id: pharmacyId },
    });
}

export async function upsertIncentiveOverride(row: any, pharmacyId: string) {
    // ⚠️ id هنا محلي مؤقت للعرض بس (متفق عليه إننا مش هنصلحه دلوقتي) — هيتصحح تلقائيًا
    // في أول refresh أونلاين لو اختلف عن اللي هيتولّد فعليًا على السيرفر
    try {
        await window.offlineAPI.upsertIncentiveOverrideCache({ ...row, pharmacy_id: pharmacyId });
    } catch (err) {
        console.error("upsertIncentiveOverrideCache failed:", err);
    }

    return queueEvent({
        id: crypto.randomUUID(),
        type: "INCENTIVE_OVERRIDE_UPSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { row },
    });
}

export async function deleteIncentiveOverride(id: string, pharmacyId: string) {
    try {
        await window.offlineAPI.deleteIncentiveOverrideCache(id);
    } catch (err) {
        console.error("deleteIncentiveOverrideCache failed:", err);
    }

    return queueEvent({
        id: crypto.randomUUID(),
        type: "INCENTIVE_OVERRIDE_DELETE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { id, pharmacy_id: pharmacyId },
    });
}

// 🆕 نقاط ولاء عميل واحد: أونلاين لو ممكن، وإلا نلاقط الرقم من خريطة الكاش المحلي
export async function getCustomerLoyaltyPoints(pharmacyId: string, customerId: string) {
    try {
        const { data, error } = await supabase.from("loyalty_points").select("*")
            .eq("pharmacy_id", pharmacyId).eq("customer_id", customerId).maybeSingle();
        if (error) throw error;
        return { data, fromCache: false };
    } catch (err) {
        if (window.offlineAPI) {
            const map = await window.offlineAPI.getLoyaltyPointsCache(pharmacyId);
            const c = map?.[customerId];
            return { data: c ? { customer_id: customerId, ...c } : null, fromCache: true };
        }
        return { data: null, fromCache: false };
    }
}

// ==================== نقاط الولاء ====================
// 🆕 نقطة كتابة موحّدة لأي حركة نقاط (كسب/استبدال/تعديل) — بتحدّث الكاش فورًا بالـ delta
// + queueEvent للمزامنة. pharmacy_id متكرر عمدًا top-level وجوه الـ payload (راجع تعليق
// الـ bug في queueEvent — case "LOYALTY_DELTA" بتقرا event.payload.pharmacy_id تحديدًا).
async function applyLoyaltyDelta(params: {
    pharmacyId: string;
    customerId: string;
    delta: number;
    type: "earn" | "redeem" | "adjust";
    refSaleId?: string;
    earnedMode?: string;
    note?: string;
}): Promise<{ synced: boolean; points: number }> {
    const { pharmacyId, customerId, delta, type, refSaleId, earnedMode, note } = params;
    const eventId = crypto.randomUUID();

    let points = 0;
    try {
        const cacheResult = await window.offlineAPI.applyLoyaltyDeltaCache({ pharmacyId, customerId, delta });
        points = cacheResult?.points ?? 0;
        await window.offlineAPI.insertLoyaltyTransactionCache({
            id: eventId, pharmacy_id: pharmacyId, customer_id: customerId, type, amount: delta,
            ref_sale_id: refSaleId || null, earned_mode: earnedMode || null, note: note || null,
            created_at: new Date().toISOString(),
        });
    } catch (err) {
        console.error("applyLoyaltyDeltaCache failed:", err);
    }

    const result = await queueEvent({
        id: eventId,
        type: "LOYALTY_DELTA",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId, // top-level — لازم لـ SQLite NOT NULL
        payload: {
            pharmacy_id: pharmacyId, // 🆕 مطلوب هنا كمان — نفس القيمة، مصدرين مختلفين للقراءة
            customer_id: customerId,
            delta,
            type,
            ref_sale_id: refSaleId ?? null,
            earned_mode: earnedMode ?? null,
            note: note ?? null,
        },
    });

    return { synced: result.synced, points };
}

export async function earnLoyaltyPoints(pharmacyId: string, customerId: string, saleId: string, points: number, mode: string) {
    if (!customerId || points <= 0) return { synced: true, points: 0 };
    return applyLoyaltyDelta({
        pharmacyId, customerId, delta: points, type: "earn",
        refSaleId: saleId, earnedMode: mode, note: `نقاط مكتسبة من فاتورة ${saleId}`,
    });
}

export async function redeemLoyaltyPoints(pharmacyId: string, customerId: string, amount: number) {
    return applyLoyaltyDelta({ pharmacyId, customerId, delta: -amount, type: "redeem", note: "استبدال نقدي" });
}

// 🆕 خصم نقاط مرتبطة بفاتورة معينة بسبب مرتجع (كامل أو جزئي) — بتستخدم نفس نوع "adjust"
// (لتفادي أي CHECK constraint على عمود type في الـ RPC/الجدول) لكن بتحتفظ بـ ref_sale_id
// عشان يفضل واضح إن الخصم ده ناتج عن مرتجع فاتورة معينة مش تعديل يدوي عشوائي.
export async function reverseLoyaltyPointsForReturn(
    pharmacyId: string,
    customerId: string,
    points: number,
    saleId: string,
    note?: string
) {
    if (!customerId || points <= 0) return { synced: true, points: 0 };
    return applyLoyaltyDelta({
        pharmacyId, customerId, delta: -points, type: "adjust",
        refSaleId: saleId, note: note || `خصم نقاط بسبب مرتجع من فاتورة ${saleId}`,
    });
}

export async function adjustLoyaltyPoints(pharmacyId: string, customerId: string, amount: number, note?: string) {
    return applyLoyaltyDelta({ pharmacyId, customerId, delta: amount, type: "adjust", note: note || "تعديل يدوي" });
}

export async function getLoyaltyPointsMap(pharmacyId: string): Promise<Record<string, any>> {
    try {
        return (await window.offlineAPI.getLoyaltyPointsCache(pharmacyId)) || {};
    } catch (err) {
        console.error("getLoyaltyPointsCache failed:", err);
        return {};
    }
}

export async function getLoyaltyTransactions(pharmacyId: string, limit = 200) {
    try {
        return await window.offlineAPI.getLoyaltyTransactionsCache({ pharmacyId, limit });
    } catch (err) {
        console.error("getLoyaltyTransactionsCache failed:", err);
        return [];
    }
}

// 🆕 إعدادات الصيدلية: أونلاين لو النت موجود (وبيحدّث الكاش فورًا)، وإلا يقرا من الكاش المحلي
export async function getPharmacySettings(pharmacyId: string) {
    try {
        const { data, error } = await supabase.from("pharmacy_settings")
            .select("*").eq("pharmacy_id", pharmacyId).single();
        if (error) throw error;
        if (data && window.offlineAPI) {
            await window.offlineAPI.upsertPharmacySettingsCache({ pharmacyId, settings: data });
        }
        return { data, fromCache: false };
    } catch (err) {
        if (window.offlineAPI) {
            const cached = await window.offlineAPI.getPharmacySettingsCache(pharmacyId);
            return { data: cached, fromCache: true };
        }
        return { data: null, fromCache: false };
    }
}

// ==================== سجل فروقات المخزون (Variance Log) ====================
// نقطة كتابة موحّدة لأي ملحوظة "رصيد الصنف مش مظبوط". المصدر المفعّل دلوقتي هو
// محاولة بيع صنف بالسكانر ورصيده صفر بالنظام (POS)، وقابلة للتوسع لاحقًا لمصادر
// تانية (تسوية يدوية، عجز/زيادة شفت) بنفس الجدول من غير تغيير في الشكل.
export async function logInventoryVariance(params: {
    pharmacyId: string;
    productId: string;
    eventType: "scan_zero_stock" | "manual_adjustment" | "shift_variance";
    createdBy?: string | null;
    notes?: string | null;
}): Promise<{ id: string; synced: boolean }> {
    const { pharmacyId, productId, eventType, createdBy, notes } = params;
    const id = crypto.randomUUID();
    const row = {
        id,
        pharmacy_id: pharmacyId,
        product_id: productId,
        event_type: eventType,
        status: "pending",
        created_by: createdBy || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
    };

    // 🆕
    if (eventType === "scan_zero_stock") {
        try {
            await window.offlineAPI?.addVarianceLogCacheEntry?.(row);
        } catch (err) {
            console.error("addVarianceLogCacheEntry failed:", err);
        }
    }

    const result = await queueEvent({
        id,
        type: "VARIANCE_LOG_INSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { row },
    });

    return { id, synced: result.synced };
}

// 🆕 بترجع كل سجلات "pending" في inventory_variance_log مهما كان event_type (رصيد صفر
// بالسكانر / تسوية يدوية / عجز شفت) — مش scan_zero_stock بس زي ما كانت قبل كده. آمن للاستخدام
// من InventoryStatement (اللي أصلاً بيستبعد أي منتج ظاهر بالفعل في baseRows بغض النظر عن
// event_type) ومن Dashboard (اللي محتاج كل الأنواع مع event_type نفسه لعرض البادج الصح).
export async function getPendingZeroStockVariance(pharmacyId: string): Promise<{ data: any[]; fromCache: boolean }> {
    try {
        const { data, error } = await supabase
            .from("inventory_variance_log")
            .select("id, product_id, event_type, notes, created_at")
            .eq("pharmacy_id", pharmacyId)
            .eq("status", "pending");
        if (error) throw error;
        try {
            await window.offlineAPI?.replaceVarianceLogCache?.({ pharmacyId, rows: data || [] });
        } catch (err) {
            console.error("replaceVarianceLogCache failed:", err);
        }
        return { data: data || [], fromCache: false };
    } catch (err) {
        if (window.offlineAPI) {
            const cached = await window.offlineAPI.getVarianceLogCache(pharmacyId);
            return { data: cached || [], fromCache: true };
        }
        return { data: [], fromCache: false };
    }
}
// ==================== فاتورة شراء مؤقتة (Draft) ====================
// سيناريو: صنف رصيده صفر بالنظام لكن اتمسح بالباركود سكانر، والصيدلي أكّد إنها
// طلبية مورد وصلت فعليًا ولسه ملحقتش تتسجل. بتعمل بالظبط نفس اللي savePurchase
// بتعمله في PurchaseModule (PURCHASE_INSERT + PURCHASE_STOCK_ADD) لكن بصنف واحد
// وحالة "مسودة" بدل "مستلمة"، عشان الرصيد يتزود فورًا ويكمل الصيدلي بيعه من
// غير ما يبيع بالسالب، والفاتورة تفضل معلّقة "بحاجة لإكمال" في شاشة المشتريات
// لحد ما حد يدخل باقي بياناتها (السعر الحقيقي، الخصومات، تاريخ الصلاحية...).
export async function createZeroStockDraftPurchase(params: {
    pharmacyId: string;
    productId: string;
    productName: string;
    supplierId: string;
    supplierName: string;
    qty: number;
    createdBy?: string | null;
    // 🆕 batch_number/expiry_date الحقيقيين بيتدخلوا يدويًا وقت تأكيد المسودة (مش placeholder
    // زي ما كان قبل كده)، عشان يتحفظوا في بند الفاتورة نفسه وفي الـ batch الفعلي اللي هيتباع
    // منه، فيبقوا صح من نقطة الإنشاء لحد الرصد لاحقًا.
    batchNumber?: string | null;
    expiryDate?: string | null;
}): Promise<{
    id: string;
    synced: boolean;
    batch: { id: string; qty: number; cost: number; salePrice: number; expiry_date: string | null; batch_number: string | null; date: string };
}> {
    const { pharmacyId, productId, productName, supplierId, supplierName, qty, createdBy, batchNumber, expiryDate } = params;
    const poId = "PO-" + crypto.randomUUID();
    const nowIso = new Date().toISOString();
    // 🆕 نفس الـ batch.id بيتولّد هنا مرة واحدة ويتحفظ في بند الفاتورة نفسها (items[0].batch_id)
    // وفي stockEvent.batch.id، عشان الفاتورة وبند المخزون الفعلي يتطابقوا بـ id مش تخمين لاحق.
    const newBatchId = crypto.randomUUID();

    const purchaseInvoice = {
        id: poId,
        date: nowIso.slice(0, 10),
        supplier: supplierId,
        supplier_name: supplierName,
        items: [{
            id: productId,
            name: productName,
            qty,
            bonusQty: 0,
            cost: 0,
            discount1: 0,
            discount2: 0,
            salePrice: 0,
            taxable: false,
            expiry_date: expiryDate || null,
            batch_number: batchNumber || null,
            batch_id: newBatchId, // 🆕 نفس id الـ batch الفعلي، مش placeholder
        }],
        subtotal: 0,
        tax_amount: 0,
        total: 0,
        status: "مسودة", // 🆕 قيمة جديدة على حقل status (كان بس "مستلمة") — تظهر
        // في شاشة فواتير الشراء كـ "بحاجة لإكمال"
        pharmacy_id: pharmacyId,
        notes: "أُنشئت تلقائيًا من نقطة البيع — رصيد صفر بالنظام وطلبية وصلت لسه ملحقتش تتسجل",
    };

    const invoiceResult = await queueEvent({
        id: crypto.randomUUID(),
        type: "PURCHASE_INSERT",
        pharmacy_id: pharmacyId,
        timestamp: nowIso,
        payload: { invoice: purchaseInvoice },
    });

    // نفس نمط retryLocalWrite في PurchaseModule — هنا try/catch بسيط كفاية لأن
    // الفشل هنا مش حرج (الـ outbox event هو مصدر الحقيقة، والكاش بس لقراءة سريعة أوفلاين)
    try {
        await window.offlineAPI?.insertPurchaseInvoiceCache?.({
            id: poId,
            pharmacy_id: pharmacyId,
            supplier_id: supplierId,
            supplier_name: supplierName,
            invoice_number: null,
            invoice_date: purchaseInvoice.date,
            created_at: nowIso,
            items: purchaseInvoice.items,
            subtotal: 0,
            tax_amount: 0,
            total: 0,
            paid_amount: 0,
            payment_status: "unpaid",
            notes: purchaseInvoice.notes,
            created_by: createdBy || null,
            returned: false,
        });
    } catch (err) {
        console.error("insertPurchaseInvoiceCache (zero-stock draft) failed:", err);
    }

    const stockEvent = {
        id: crypto.randomUUID(),
        pharmacy_id: pharmacyId,
        product_id: productId,
        batch: {
            id: newBatchId, // 🆕 نفس id اللي اتحفظ في بند الفاتورة، مش عشوائي مستقل
            qty,
            cost: 0,
            salePrice: 0,
            expiry_date: expiryDate || null,
            batch_number: batchNumber || null,
            date: purchaseInvoice.date,
        },
        reference_id: poId,
        created_at: nowIso,
        device_id: getDeviceId(),
    };

    await queueEvent({
        id: crypto.randomUUID(),
        type: "PURCHASE_STOCK_ADD",
        pharmacy_id: pharmacyId,
        timestamp: nowIso,
        payload: { events: [stockEvent] },
    });

    try {
        await window.offlineAPI?.applyProductStockDeltaCache?.({
            pharmacyId,
            deltas: [{ id: productId, delta: qty }],
        });
    } catch (err) {
        console.error("applyProductStockDeltaCache (zero-stock draft) failed:", err);
    }

    return { id: poId, synced: invoiceResult.synced, batch: stockEvent.batch };
}

// 🆕 لو الصيدلي بيبيع صنف تاني (رصيده صفر برضه) من نفس المورد واللي أصلاً ليه فاتورة
// "مسودة" لسه مفتوحة (اتعملت بنفس الآلية فوق وماكملتش بياناتها بعد)، الأصح إننا نضيف
// بند جديد لنفس الفاتورة دي بدل ما نفتح فاتورة مسودة جداد لكل صنف — غير كده هيبقى عندك
// 5 فواتير "بحاجة لإكمال" من نفس المورد في نفس اليوم بدل فاتورة واحدة فيها كل الأصناف.
export async function addItemToZeroStockDraftPurchase(params: {
    pharmacyId: string;
    poId: string; // 🆕 id الفاتورة المسودة المفتوحة أصلاً (من نداء createZeroStockDraftPurchase سابق)
    existingItems: any[]; // 🆕 بنود الفاتورة الحالية (بتتفضل متتبّعة في POS.tsx) — بنضيف عليها البند الجديد
    supplierId: string;
    supplierName: string;
    productId: string;
    productName: string;
    qty: number;
    createdBy?: string | null;
    batchNumber?: string | null;
    expiryDate?: string | null;
}): Promise<{
    synced: boolean;
    items: any[];
    batch: { id: string; qty: number; cost: number; salePrice: number; expiry_date: string | null; batch_number: string | null; date: string };
}> {
    const { pharmacyId, poId, existingItems, supplierId, supplierName, productId, productName, qty, createdBy, batchNumber, expiryDate } = params;
    const nowIso = new Date().toISOString();
    const invoiceDate = nowIso.slice(0, 10);
    // 🆕 نفس مبدأ createZeroStockDraftPurchase: batch.id واحد بيتحفظ في البند وفي حركة
    // المخزون معًا، مش عشوائي منفصل.
    const newBatchId = crypto.randomUUID();

    const newItem = {
        id: productId,
        name: productName,
        qty,
        bonusQty: 0,
        cost: 0,
        discount1: 0,
        discount2: 0,
        salePrice: 0,
        taxable: false,
        expiry_date: expiryDate || null,
        batch_number: batchNumber || null,
        batch_id: newBatchId,
    };
    const updatedItems = [...(existingItems || []), newItem];

    const updateResult = await queueEvent({
        id: crypto.randomUUID(),
        type: "PURCHASE_UPDATE", // case عامة موجودة أصلاً في executeSyncedEvent — بتعمل update على أي عمود
        pharmacy_id: pharmacyId,
        timestamp: nowIso,
        payload: { id: poId, pharmacy_id: pharmacyId, updates: { items: updatedItems } },
    });

    // نفس نمط try/catch البسيط المستخدم فوق — الكاش هنا لقراءة سريعة أوفلاين بس، مش مصدر الحقيقة
    try {
        await window.offlineAPI?.insertPurchaseInvoiceCache?.({
            id: poId,
            pharmacy_id: pharmacyId,
            supplier_id: supplierId,
            supplier_name: supplierName,
            invoice_number: null,
            invoice_date: invoiceDate,
            created_at: nowIso,
            items: updatedItems,
            subtotal: 0,
            tax_amount: 0,
            total: 0,
            paid_amount: 0,
            payment_status: "unpaid",
            notes: "أُنشئت تلقائيًا من نقطة البيع — رصيد صفر بالنظام وطلبية وصلت لسه ملحقتش تتسجل",
            created_by: createdBy || null,
            returned: false,
        });
    } catch (err) {
        console.error("insertPurchaseInvoiceCache (append to zero-stock draft) failed:", err);
    }

    const stockEvent = {
        id: crypto.randomUUID(),
        pharmacy_id: pharmacyId,
        product_id: productId,
        batch: {
            id: newBatchId,
            qty,
            cost: 0,
            salePrice: 0,
            expiry_date: expiryDate || null,
            batch_number: batchNumber || null,
            date: invoiceDate,
        },
        reference_id: poId, // 🆕 نفس poId الأصلي — الحركة دي بتتبع لنفس فاتورة الشراء المفتوحة
        created_at: nowIso,
        device_id: getDeviceId(),
    };

    await queueEvent({
        id: crypto.randomUUID(),
        type: "PURCHASE_STOCK_ADD",
        pharmacy_id: pharmacyId,
        timestamp: nowIso,
        payload: { events: [stockEvent] },
    });

    try {
        await window.offlineAPI?.applyProductStockDeltaCache?.({
            pharmacyId,
            deltas: [{ id: productId, delta: qty }],
        });
    } catch (err) {
        console.error("applyProductStockDeltaCache (append to zero-stock draft) failed:", err);
    }

    return { synced: updateResult.synced, items: updatedItems, batch: stockEvent.batch };
}
export async function saveProduct(product: any, pharmacyId: string, editing: boolean) {
    const productWithDefaults = { stock: 0, ...product };
    await window.offlineAPI?.upsertProductsCache?.({ pharmacyId, products: [productWithDefaults] });
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PRODUCT_SAVE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId, // top-level — لازم لـ SQLite NOT NULL
        payload: { product, editing, pharmacy_id: pharmacyId }, // 🔧 مكرر هنا كمان — نفس القيمة، مصدرين مختلفين للقراءة
    });
}

export async function replaceProductBarcodes(productId: string, pharmacyId: string, rows: any[]) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PRODUCT_BARCODES_REPLACE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { productId, rows, pharmacy_id: pharmacyId },
    });
}

export async function replaceProductIngredients(productId: string, pharmacyId: string, rows: any[]) {
    return queueEvent({
        id: crypto.randomUUID(),
        type: "PRODUCT_INGREDIENTS_REPLACE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { productId, rows, pharmacy_id: pharmacyId },
    });
}
export async function addItemType(nameAr: string, pharmacyId: string, nameEn?: string) {
    const id = crypto.randomUUID();
    const record = { id, name_ar: nameAr, name_en: nameEn || null, pharmacy_id: pharmacyId };

    // كاش محلي فوري — يظهر في القايمة فورًا حتى لو أوفلاين
    try {
        await window.offlineAPI?.upsertItemTypeCache?.(record);
    } catch (err) {
        console.error("upsertItemTypeCache failed:", err);
    }

    const result = await queueEvent({
        id: crypto.randomUUID(),
        type: "ITEM_TYPE_INSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId, // top-level — لازم لـ SQLite NOT NULL
        payload: { record, pharmacy_id: pharmacyId }, // مكرر هنا كمان
    });

    return { id, synced: result.synced, error: result.error };
}
export async function addSubCategory2(nameAr: string, mainCategory: string, pharmacyId: string, nameEn?: string) {
    const id = crypto.randomUUID();
    const record = { id, main_category: mainCategory, name_ar: nameAr, name_en: nameEn || null, pharmacy_id: pharmacyId };

    try {
        await window.offlineAPI?.upsertSubCategory2Cache?.({ pharmacyId, item: record });
    } catch (err) {
        console.error("upsertSubCategory2Cache failed:", err);
    }

    const result = await queueEvent({
        id: crypto.randomUUID(),
        type: "SUB_CATEGORY2_INSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { record, pharmacy_id: pharmacyId },
    });

    return { id, synced: result.synced, error: result.error };
}

export async function deleteItemType(id: string, pharmacyId: string) {
    try {
        await window.offlineAPI?.deleteItemTypeCache?.({ pharmacyId, id });
    } catch (err) {
        console.error("deleteItemTypeCache failed:", err);
    }

    return queueEvent({
        id: crypto.randomUUID(),
        type: "ITEM_TYPE_DELETE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { id, pharmacy_id: pharmacyId },
    });
}

export async function deleteSubCategory2(id: string, pharmacyId: string) {
    try {
        await window.offlineAPI?.deleteSubCategory2Cache?.({ pharmacyId, id });
    } catch (err) {
        console.error("deleteSubCategory2Cache failed:", err);
    }

    return queueEvent({
        id: crypto.randomUUID(),
        type: "SUB_CATEGORY2_DELETE",
        timestamp: new Date().toISOString(),
        pharmacy_id: pharmacyId,
        payload: { id, pharmacy_id: pharmacyId },
    });
}
// ═══════════════════════════════════════════════════════════════════
// 🆕 نقطة كتابة موحّدة لأي قيد خزنة (تستخدمها كل الموديولات: مرتجعات، موردين، شفتات، تقفيل).
// بتكتب فوراً في الكاش المحلي (عشان الشاشات تعرض القيمة فوراً) + تعمل queueEvent للمزامنة.
// بترجع الـ id المحلي عشان الموديول يعمل optimistic update على state بتاعه.
// ═══════════════════════════════════════════════════════════════════
export async function insertTreasuryEntry(entry: {
    type: "income" | "expense";
    sub_type: string;
    method?: string;
    amount: number;
    note: string;
    date: string;
    pharmacy_id: string;
    created_by: string;
    ref_id?: string;
}): Promise<{ id: string; synced: boolean }> {
    const id = crypto.randomUUID();
    const fullEntry = { id, ...entry };

    try {
        await window.offlineAPI.upsertTreasuryEntryCache(fullEntry);
    } catch (err) {
        console.error("upsertTreasuryEntryCache failed:", err);
    }

    const result = await queueEvent({
        id,
        type: "TREASURY_ENTRY_INSERT",
        timestamp: new Date().toISOString(),
        pharmacy_id: entry.pharmacy_id, // 🆕 نفس تصحيح insertTreasuryEntries، كان ناقص هنا بالتحديد
        payload: { entry: fullEntry },
    });

    return { id, synced: result.synced };
}

// 🆕 نسخة مجمّعة من insertTreasuryEntry — لحالات تقفيل اليوم/التقفيل بأثر رجعي اللي
// بتسجّل كذا قيد دفعة واحدة (دخل نقدي/بطاقة/تحويل + مصروفات + تسوية فرق البطاقة).
// كل صف بياخد id مستقل وبيتبعت كـ TREASURY_ENTRY_INSERT منفصل، فلو النت اتقطع نص الطريق
// أثناء المزامنة، اللي اتزامن فعلاً بيفضل متزامن والباقي بيتأجل، مفيش فقد أو تكرار.
export async function insertTreasuryEntries(entries: Array<{
    type: "income" | "expense" | "closing";
    sub_type: string;
    method?: string;
    amount: number;
    note: string;
    date: string;
    pharmacy_id: string;
    created_by: string;
    ref_id?: string;
}>): Promise<Array<{ id: string; synced: boolean }>> {
    const results = [];
    for (const entry of entries) {
        // insertTreasuryEntry بتعمل type "income" | "expense" بس — القيود من نوع "closing"
        // (علامة تقفيل اليوم بمبلغ صفر) بتتبعت هنا مباشرة بنفس آلية insertTreasuryEntry
        const id = crypto.randomUUID();
        const fullEntry = { id, ...entry };
        try {
            await window.offlineAPI.upsertTreasuryEntryCache(fullEntry);
        } catch (err) {
            console.error("upsertTreasuryEntryCache failed:", err);
        }
        const result = await queueEvent({
            id,
            type: "TREASURY_ENTRY_INSERT",
            timestamp: new Date().toISOString(),
            pharmacy_id: entry.pharmacy_id, // 🆕 ناقص كان — لازم على مستوى الـ
            payload: { entry: fullEntry },
        });
        results.push({ id, synced: result.synced });
    }
    return results;
}

let initialized = false;
export function initOfflineSync() {
    if (initialized) return;
    initialized = true;
    window.addEventListener("online", () => syncQueue());
    setInterval(() => syncQueue(), 30000);
    syncQueue();
}
