export const BarcodeScanner = ({
  onScan,
  placeholder = "امسح أو اكتب الباركود...",
}) => {
  const [val, setVal] = useState("");
  const ref = useRef();

  const handleScan = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // كشف إذا كان GS1 2D باركود
    const isGS1 =
      trimmed.includes("(01)") ||
      trimmed.includes(")01(") ||
      /^01\d{14}/.test(trimmed);

    if (isGS1) {
      const parsed = parseGS1Barcode(trimmed);
      onScan({ type: "gs1", ...parsed });
    } else {
      onScan({ type: "simple", code: trimmed, raw: trimmed });
    }
    setVal("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && val.trim()) handleScan(val);
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <IC
        n="barcode"
        s={18}
        style={{ position: "absolute", right: 10, color: "#3a5aaa" }}
      />
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        style={{
          background: "#080e1a",
          border: "1px solid #2a5a9a",
          borderRadius: 8,
          padding: "9px 12px 9px 40px",
          color: "#dde8ff",
          fontSize: 14,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
      <Btn size="sm" onClick={() => handleScan(val)} icon="search">
        بحث
      </Btn>
    </div>
  );
};
// ==================== LOGIN ====================
