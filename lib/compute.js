// Formateur adaptatif selon la devise
export function fmt(v, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
}

export function fmtAuto(v, currency) {
  // Si la devise est connue, on l'utilise, sinon EUR par défaut
  try { return fmt(v, currency || 'EUR'); } catch { return fmt(v, 'EUR'); }
}

export function enrich(rows) {
  return rows.map(r => {
    const currency = r.currency || 'EUR';
    const value = r.qty * r.price;
    const cost = r.qty * r.pru;
    const perf = value - cost;
    const buyQty = r.buys?.reduce((s, b) => s + b.qty, 0) || 0;
    const buyCost = r.buys?.reduce((s, b) => s + b.qty * b.price, 0) || 0;
    return { ...r, currency, value, cost, perf, perfPct: cost ? perf / cost * 100 : 0, avgBuy: buyQty ? buyCost / buyQty : r.pru };
  });
}

export function summarize(rows) {
  const computed = enrich(rows);
  // Somme tout en valeur brute (devise mixte possible, affiché comme info)
  const total = computed.reduce((s, r) => s + r.value, 0);
  const cost = computed.reduce((s, r) => s + r.cost, 0);
  const perf = total - cost;
  const bySector = computed.reduce((a, r) => (a[r.sector] = (a[r.sector] || 0) + r.value, a), {});
  return { computed, total, cost, perf, cash: 0, bySector };
}
