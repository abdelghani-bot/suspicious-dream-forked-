import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { COLORS } from "../theme";
import { isGS1Formatted, parseCustomExpiryBarcode, parseGS1Barcode } from "../lib/barcodeUtils";
import { Btn, IC } from "../ui/primitives";

// ==================== BARCODE SCANNER ====================
// خريطة الأزرار الفيزيائية (event.code) لكيبورد US، بيها الوضع العادي والوضع مع Shift.
// بنستخدم event.code (مش event.key) عشان ده بيرجع "الزرار اللي اتدوس فعليًا" بغض النظر
// عن لغة نظام التشغيل الحالية (عربي/إنجليزي)، فالسكانر يفضل يبعت القيم الصح دايمًا
// حتى لو الويندوز شغال عربي، وده بيحل مشكلة رموز زي "*" أو حروف زي "P" بتتقلب لحاجة غلط.
export const US_KEY_MAP: Record<string, [string, string]> = {
  Backquote: ["`", "~"],
  Digit1: ["1", "!"], Digit2: ["2", "@"], Digit3: ["3", "#"], Digit4: ["4", "$"],
  Digit5: ["5", "%"], Digit6: ["6", "^"], Digit7: ["7", "&"], Digit8: ["8", "*"],
  Digit9: ["9", "("], Digit0: ["0", ")"],
  Minus: ["-", "_"], Equal: ["=", "+"],
  BracketLeft: ["[", "{"], BracketRight: ["]", "}"], Backslash: ["\\", "|"],
  Semicolon: [";", ":"], Quote: ["'", "\""], Comma: [",", "<"], Period: [".", ">"], Slash: ["/", "?"],
  Space: [" ", " "],
  Numpad0: ["0", "0"], Numpad1: ["1", "1"], Numpad2: ["2", "2"], Numpad3: ["3", "3"],
  Numpad4: ["4", "4"], Numpad5: ["5", "5"], Numpad6: ["6", "6"], Numpad7: ["7", "7"],
  Numpad8: ["8", "8"], Numpad9: ["9", "9"], NumpadDecimal: [".", "."],
  NumpadMultiply: ["*", "*"], NumpadAdd: ["+", "+"], NumpadSubtract: ["-", "-"], NumpadDivide: ["/", "/"],
};


for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(97 + i); // a-z
  US_KEY_MAP["Key" + letter.toUpperCase()] = [letter, letter.toUpperCase()];
}



export const BarcodeScanner = forwardRef(({
  onScan,
  placeholder = "امسح أو اكتب الباركود...",
}, forwardedRef) => {
  const [val, setVal] = useState("");
  const bufferRef = useRef<string>("");
  const ref = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const keyCount = useRef<number>(0);
  const scanTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useImperativeHandle(forwardedRef, () => ({
    focus: () => ref.current?.focus(),
  }));

  const handleScan = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const isGS1 = isGS1Formatted(trimmed);

    if (isGS1) {
      const parsed = parseGS1Barcode(trimmed);
      onScan({ type: "gs1", ...parsed });
    } else {
      // نجرب الشكل البديل بتاعنا (CODE*YYMMDD أو CODE*YYMMDD*BATCH) قبل ما نعتبره
      // باركود بسيط عادي - ده بيغطي الأصناف اللي كودها مش GTIN رقمي (زي P006)
      const custom = parseCustomExpiryBarcode(trimmed);
      if (custom) {
        onScan({ type: "custom", code: custom.code, expiry: custom.expiry, batch: custom.batch, raw: trimmed });
      } else {
        onScan({ type: "simple", code: trimmed, raw: trimmed });
      }
    }
    bufferRef.current = "";
    setVal("");
    keyCount.current = 0;
  };

  const registerKeystroke = (newVal: string) => {
    const now = Date.now();
    const timeDiff = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // لو الفرق بين ضغطتين أقل من 100ms → scanner حقيقي (سرعة كتابة السكانر أعلى من أي إنسان)
    if (timeDiff < 100) {
      keyCount.current += 1;
    } else {
      keyCount.current = 1;
    }

    // لو اتكتبت 4 حروف أو أكثر بسرعة → امسح تلقائياً بعد 50ms
    if (keyCount.current >= 4) {
      if (scanTimer.current) clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => {
        if (newVal.trim()) handleScan(newVal);
      }, 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl/Cmd + حرف (نسخ/لصق/تحديد الكل...) نسيبها تشتغل عادي من غير تدخل
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (scanTimer.current) clearTimeout(scanTimer.current);
      if (bufferRef.current.trim()) handleScan(bufferRef.current);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      bufferRef.current = bufferRef.current.slice(0, -1);
      setVal(bufferRef.current);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      bufferRef.current = "";
      setVal("");
      keyCount.current = 0;
      return;
    }

    const mapped = US_KEY_MAP[e.code];
    if (mapped) {
      // نمنع السلوك الافتراضي عشان نفك ارتباط القيمة عن لغة نظام التشغيل تمامًا
      e.preventDefault();
      const ch = e.shiftKey ? mapped[1] : mapped[0];
      const newVal = bufferRef.current + ch;
      bufferRef.current = newVal;
      setVal(newVal);
      registerKeystroke(newVal);
    }
    // أي زرار مش موجود في الخريطة (Tab, F1, أسهم...) بنسيبه يعدي عادي من غير تعديل
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;
    const newVal = bufferRef.current + pasted;
    bufferRef.current = newVal;
    setVal(newVal);
  };

  return (
    <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "center" }}>
      <IC n="barcode" s={18} style={{ position: "absolute", right: 10, color: COLORS.textDim }} />
      <input
        ref={ref}
        value={val}
        onChange={() => {}}
        onKeyDown={handleKey}
        onPaste={handlePaste}
        placeholder={placeholder}
        style={{
          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: "9px 12px 9px 40px",
          color: COLORS.textPrimary,
          fontSize: 14,
          outline: "none",
          width: "100%",
          boxSizing: "border-box" as any,
        }}
      />
      <Btn size="sm" onClick={() => handleScan(val)} icon="search">
        بحث
      </Btn>
    </div>
  );
});
