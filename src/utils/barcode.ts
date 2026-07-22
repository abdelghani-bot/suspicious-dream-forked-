export function parseGS1Barcode(raw) {
  const result = {
    gtin: null,
    expiry: null,
    batch: null,
    serial: null,
    raw,
  };

  try {
    // إزالة الأقواس وتحويل لـ standard GS1 format
    const cleaned = raw
      .replace(/\)(\d{2})\(/g, "$1") // )(01)( → 01
      .replace(/^\(/, "") // إزالة أول قوس
      .replace(/\)/, ""); // إزالة آخر قوس

    let i = 0;
    while (i < cleaned.length) {
      const ai = cleaned.substring(i, i + 2);

      if (ai === "01") {
        result.gtin = cleaned.substring(i + 2, i + 16);
        i += 16;
      } else if (ai === "17") {
        const raw = cleaned.substring(i + 2, i + 8); // YYMMDD
        result.expiry = `20${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(
          4,
          6
        )}`;
        i += 8;
      } else if (ai === "10") {
        // batch - variable length, ends at next AI or end
        const rest = cleaned.substring(i + 2);
        const nextAI = rest.search(/(?:17|21)\d/);
        if (nextAI === -1) {
          result.batch = rest;
          i = cleaned.length;
        } else {
          result.batch = rest.substring(0, nextAI);
          i += 2 + nextAI;
        }
      } else if (ai === "21") {
        result.serial = cleaned.substring(i + 2);
        i = cleaned.length;
      } else {
        i++;
      }
    }
  } catch (e) {
    console.error("GS1 parse error:", e);
  }

  return result;
}
// ==================== MAIN APP ====================
