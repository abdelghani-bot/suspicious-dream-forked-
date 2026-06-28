export function calcAutoDiscount(expiryDate, rules?) {
  if (!expiryDate) return 0;
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 0;
  const activeRules = rules || [
    { days: 90,  discount: 50 },
    { days: 120, discount: 25 },
    { days: 150, discount: 20 },
    { days: 180, discount: 15 },
  ];
  const sorted = [...activeRules].sort((a, b) => a.days - b.days);
  for (const rule of sorted) {
    if (days <= rule.days) return rule.discount;
  }
  return 0;
}

