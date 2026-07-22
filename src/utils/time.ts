export function isRamadan() {
  const now = new Date();
  const ranges = [
    { start: new Date("2025-03-01"), end: new Date("2025-03-30") },
    { start: new Date("2026-02-18"), end: new Date("2026-03-19") },
  ];
  return ranges.some((r) => now >= r.start && now <= r.end);
}

function fmt(ts: string | null) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function diffMin(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function fmtHours(h: number) {
  if (!h && h !== 0) return "٠:٠٠";
  const hrs = Math.floor(Math.abs(h));
  const mins = Math.round((Math.abs(h) - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, "0")}`;
}

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const API_KEY_MAP: Record<string, string> = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
const ACTIVE_PRAYERS = ["الظهر", "العصر", "المغرب", "العشاء"];

async function fetchPrayerTimes() {
  const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  const url = `https://api.aladhan.com/v1/timings/${today}?latitude=24.7136&longitude=46.6753&method=4`;
  const res = await fetch(url);
  const json = await res.json();
  const timings = json.data.timings;
  const result: Record<string, string> = {};
  Object.entries(API_KEY_MAP).forEach(([en, ar]) => {
    if (!ACTIVE_PRAYERS.includes(ar)) return;
    const [h, m] = (timings[en] as string).split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    result[ar] = d.toISOString();
  });
  if (new Date().getDay() === 5 && result["الظهر"]) {
    result["الجمعة"] = result["الظهر"];
    delete result["الظهر"];
  }
  return result;
}
// ══════════════════════════════════════════════════════
// Component منفصل — ضعه خارج AttendanceModule
// ══════════════════════════════════════════════════════
