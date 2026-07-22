// ── قائمة المدن السعودية لحساب مواقيت الصلاة ──
export const SAUDI_CITIES = [
  { id: "riyadh", name: "الرياض", lat: 24.7136, lng: 46.6753 },
  { id: "jeddah", name: "جدة", lat: 21.4858, lng: 39.1925 },
  { id: "makkah", name: "مكة المكرمة", lat: 21.3891, lng: 39.8579 },
  { id: "madinah", name: "المدينة المنورة", lat: 24.5247, lng: 39.5692 },
  { id: "dammam", name: "الدمام", lat: 26.4207, lng: 50.0888 },
  { id: "khobar", name: "الخبر", lat: 26.2172, lng: 50.1971 },
  { id: "dhahran", name: "الظهران", lat: 26.2361, lng: 50.0393 },
  { id: "taif", name: "الطائف", lat: 21.2703, lng: 40.4158 },
  { id: "tabuk", name: "تبوك", lat: 28.3998, lng: 36.5700 },
  { id: "abha", name: "أبها", lat: 18.2164, lng: 42.5053 },
  { id: "khamis_mushait", name: "خميس مشيط", lat: 18.3000, lng: 42.7333 },
  { id: "buraidah", name: "بريدة", lat: 26.3260, lng: 43.9750 },
  { id: "hail", name: "حائل", lat: 27.5114, lng: 41.6900 },
  { id: "najran", name: "نجران", lat: 17.4924, lng: 44.1277 },
  { id: "jazan", name: "جازان", lat: 16.8892, lng: 42.5611 },
  { id: "al_ahsa", name: "الأحساء", lat: 25.3833, lng: 49.5833 },
  { id: "yanbu", name: "ينبع", lat: 24.0896, lng: 38.0618 },
  { id: "qatif", name: "القطيف", lat: 26.5208, lng: 49.9989 },
  { id: "arar", name: "عرعر", lat: 30.9753, lng: 41.0381 },
  { id: "sakaka", name: "سكاكا", lat: 29.9697, lng: 40.2064 },
];



export const API_KEY_MAP: Record<string, string> = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };


export const ACTIVE_PRAYERS = ["الظهر", "العصر", "المغرب", "العشاء"];



export async function fetchPrayerTimes(lat = 24.7136, lng = 46.6753) {
  const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  const url = `https://api.aladhan.com/v1/timings/${today}?latitude=${lat}&longitude=${lng}&method=4`;
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
