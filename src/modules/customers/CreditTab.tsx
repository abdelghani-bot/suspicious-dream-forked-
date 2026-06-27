export function CreditTab({
  const { C } = useTheme(); customers, onPay }) {
  const [creditData, setCreditData] = useState([]);

  useEffect(() => {
    const fetchCredit = async () => {
      const { data: ajilSales } = await supabase
        .from("sales")
        .select("*")
        .eq("payment", "آجل");

      const { data: paid } = await supabase.from("credit_payments").select("*");

      const byCustomer = customers
        .map((c) => {
          const cSales = ajilSales?.filter((s) => s.customer === c.id) || [];
          const totalDebt = cSales.reduce((s, inv) => {
            const totalPaid =
              paid
                ?.filter((p) => p.invoice_id === inv.id)
                .reduce((x, p) => x + p.amount, 0) || 0;
            return s + (inv.total - totalPaid);
          }, 0);
          return { ...c, totalDebt, invoiceCount: cSales.length };
        })
        .filter((c) => c.totalDebt > 0);

      setCreditData(byCustomer);
    };
    fetchCredit();
  }, []);

  return (
    <div>
      <h3 style={{ color: C.text, marginBottom: 14 }}>💳 مديونية العملاء</h3>
      {creditData.length === 0 ? (
        <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>
          لا توجد مديونيات
        </div>
      ) : (
        creditData.map((c) => (
          <div
            key={c.id}
            style={{
              background: C.surface,
              border: "1px solid #2a1010",
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: C.text }}>{c.name}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                {c.invoiceCount} فاتورة آجل •{" "}
                <span style={{ color: C.danger }}>
                  متبقي: {c.totalDebt.toFixed(2)} ر.س
                </span>
              </div>
            </div>
            <button
              onClick={() => onPay(c)}
              style={{
                background: "#0a2a1a",
                border: "1px solid #1a4a2a",
                borderRadius: 8,
                padding: "6px 14px",
                color: C.success,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              💰 سداد
            </button>
          </div>
        ))
      )}
    </div>
  );
}
