import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { toLocaleString } from "../function toLocaleString() { [native code] }/undefined";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "../lib/auditLog";
import { Badge, Pagination, Table } from "../ui/primitives";

export function AuditLogModule({ pharmacyId, showToast }: { pharmacyId: string; showToast: (m: string, t?: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  // 🆕 Pagination — سجل العمليات ممكن يبقى فيه مئات السطور، فبنعرضه صفحة صفحة بدل كله دفعة واحدة.
  const AUDIT_PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filterUser, filterAction, filterEntity, fromDate, toDate, search]);

  const loadLogs = useCallback(async () => {
    if (!pharmacyId) return;
    setLoading(true);
    let q = supabase.from("audit_logs").select("*").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(500);
    if (fromDate) q = q.gte("created_at", fromDate + "T00:00:00");
    if (toDate) q = q.lte("created_at", toDate + "T23:59:59");
    const { data, error } = await q;
    if (error) { showToast("خطأ في تحميل سجل العمليات: " + error.message, "error"); setLoading(false); return; }
    setLogs(data || []);
    setLoading(false);
  }, [pharmacyId, fromDate, toDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const uniqueUsers = useMemo(() => Array.from(new Set(logs.map((l) => l.user_name).filter(Boolean))), [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filterUser && l.user_name !== filterUser) return false;
      if (filterAction && l.action !== filterAction) return false;
      if (filterEntity && l.entity_type !== filterEntity) return false;
      if (search) {
        const s = search.trim().toLowerCase();
        const hay = `${l.entity_label || ""} ${l.description || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [logs, filterUser, filterAction, filterEntity, search]);

  const fmtDT = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const renderDiff = (log: any) => {
    if (log.old_value && log.new_value) {
      const changedKeys = Object.keys(log.new_value).filter((k) => JSON.stringify(log.old_value[k]) !== JSON.stringify(log.new_value[k]));
      if (changedKeys.length === 0) return null;
      return (
        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
          {changedKeys.map((k) => (
            <div key={k}>
              <span style={{ color: COLORS.border }}>{k}:</span>{" "}
              <span style={{ color: COLORS.red, textDecoration: "line-through" }}>{String(log.old_value[k])}</span>
              {" ← "}
              <span style={{ color: COLORS.green, fontWeight: 700 }}>{String(log.new_value[k])}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>📜 سجل العمليات</h2>
      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 16 }}>
        سجل كامل بكل عمليات الحذف والتعديل الحساسة (الأصناف، الأسعار، الموردين، العملاء) — يوضّح مين نفّذ العملية ومتى.
      </div>

      {/* فلاتر */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, padding: 14,
        background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${COLORS.border}`, borderRadius: 14,
      }}>
        <input
          placeholder="🔍 بحث بالاسم أو الوصف..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 200px", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13 }}
        />
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13 }}>
          <option value="">كل المستخدمين</option>
          {uniqueUsers.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13 }}>
          <option value="">كل العمليات</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13 }}>
          <option value="">كل الأنواع</option>
          {Object.entries(AUDIT_ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13 }} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: COLORS.textDim }}>جارٍ التحميل...</div>
      ) : (
        <>
          <Table
            headers={["الوقت", "المستخدم", "العملية", "النوع", "التفاصيل"]}
            emptyMsg="لا توجد عمليات مسجّلة"
            rows={filtered.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE).map((log) => {
              const actionInfo = AUDIT_ACTION_LABELS[log.action] || { label: log.action, color: COLORS.textDim, bg: COLORS.surfaceAlt };
              return [
                <span style={{ fontSize: 12, color: COLORS.textDim, whiteSpace: "nowrap" }}>{fmtDT(log.created_at)}</span>,
                <span style={{ fontWeight: 700 }}>{log.user_name}</span>,
                <Badge color={actionInfo.bg} text={actionInfo.color}>{actionInfo.label}</Badge>,
                <span style={{ fontSize: 12, color: COLORS.textDim }}>{AUDIT_ENTITY_LABELS[log.entity_type] || log.entity_type}</span>,
                <div>
                  <div style={{ fontWeight: 600 }}>{log.entity_label || "—"}</div>
                  {log.description && <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{log.description}</div>}
                  {renderDiff(log)}
                </div>,
              ];
            })}
          />
          <Pagination page={page} onPageChange={setPage} totalItems={filtered.length} pageSize={AUDIT_PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
