// Résout un ISIN en métadonnées (nom, ticker, cours)
// Utilise Alpha Vantage SYMBOL_SEARCH pour trouver le ticker depuis l'ISIN
// Fallback : retourne un mock si la clé API n'est pas définie

const KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE = 'https://www.alphavantage.co/query';

// Mapping manuel pour les valeurs françaises courantes
const KNOWN = {
  'FR0000120073': { name: 'Air Liquide', ticker: 'AI.PA', sector: 'Industrie', type: 'Action', price: 172.9 },
  'FR0000121014': { name: 'LVMH', ticker: 'MC.PA', sector: 'Luxe', type: 'Action', price: 395 },
  'FR0000120271': { name: 'TotalEnergies', ticker: 'TTE.PA', sector: 'Énergie', type: 'Action', price: 61.75 },
  'FR0000045072': { name: 'Crédit Agricole', ticker: 'ACA.PA', sector: 'Finance', type: 'Action', price: 15.92 },
  'FR0000131104': { name: 'BNP Paribas', ticker: 'BNP.PA', sector: 'Finance', type: 'Action', price: 72.1 },
  'FR0000120321': { name: 'L\'Oréal', ticker: 'OR.PA', sector: 'Consommation', type: 'Action', price: 310 },
  'FR0000120628': { name: 'AXA', ticker: 'CS.PA', sector: 'Finance', type: 'Action', price: 34.5 },
  'FR0000124141': { name: 'Veolia', ticker: 'VIE.PA', sector: 'Services', type: 'Action', price: 28.4 },
  'FR0000120503': { name: 'Bouygues', ticker: 'EN.PA', sector: 'Industrie', type: 'Action', price: 31.2 },
  'FR0010527275': { name: 'Amundi MSCI World PEA', ticker: 'CW8.PA', sector: 'Monde', type: 'ETF', price: 167.58 },
  'FR0013412285': { name: 'Amundi CAC 40 PEA', ticker: 'C40.PA', sector: 'France', type: 'ETF', price: 53.2 },
  'LU1681043599': { name: 'Lyxor Core MSCI World PEA', ticker: 'LCWD.PA', sector: 'Monde', type: 'ETF', price: 42.3 },
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const isin = searchParams.get('isin')?.toUpperCase();
  if (!isin) return Response.json({ error: 'ISIN manquant' }, { status: 400 });

  // 1. Mapping connu
  if (KNOWN[isin]) {
    const k = KNOWN[isin];
    if (!KEY) return Response.json({ ...k, isin, source: 'mock' });
    // Récupère le cours réel si la clé est disponible
    try {
      const url = `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(k.ticker)}&apikey=${encodeURIComponent(KEY)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      const price = Number(data?.['Global Quote']?.['05. price'] ?? k.price);
      return Response.json({ ...k, isin, price, source: 'alphavantage' });
    } catch {
      return Response.json({ ...k, isin, source: 'mock-fallback' });
    }
  }

  // 2. Recherche via Alpha Vantage SYMBOL_SEARCH sur l'ISIN
  if (KEY) {
    try {
      const url = `${BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(isin)}&apikey=${encodeURIComponent(KEY)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      const match = data?.bestMatches?.[0];
      if (match) {
        const ticker = match['1. symbol'];
        const name = match['2. name'];
        const type = match['3. type'] === 'ETF' ? 'ETF' : 'Action';
        // Récupère le cours
        const qUrl = `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(KEY)}`;
        const qRes = await fetch(qUrl, { cache: 'no-store' });
        const qData = await qRes.json();
        const price = Number(qData?.['Global Quote']?.['05. price'] ?? 0);
        return Response.json({ name, ticker, isin, price, sector: 'Autre', type, source: 'alphavantage-search' });
      }
    } catch {}
  }

  return Response.json({ error: 'ISIN introuvable. Vérifie le code ou ajoute-le au mapping dans api/isin/route.js.' }, { status: 404 });
}
