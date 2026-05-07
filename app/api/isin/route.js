const KEY = process.env.ALPHA_VANTAGE_API_KEY;
const AV_BASE = 'https://www.alphavantage.co/query';

const KNOWN = {
  'FR0000120073': { name: 'Air Liquide', ticker: 'AI.PA', sector: 'Industrie', type: 'Action' },
  'FR0000121014': { name: 'LVMH', ticker: 'MC.PA', sector: 'Luxe', type: 'Action' },
  'FR0000120271': { name: 'TotalEnergies', ticker: 'TTE.PA', sector: 'Énergie', type: 'Action' },
  'FR0000045072': { name: 'Crédit Agricole', ticker: 'ACA.PA', sector: 'Finance', type: 'Action' },
  'FR0000131104': { name: 'BNP Paribas', ticker: 'BNP.PA', sector: 'Finance', type: 'Action' },
  'FR0000120321': { name: "L'Oréal", ticker: 'OR.PA', sector: 'Consommation', type: 'Action' },
  'FR0000120628': { name: 'AXA', ticker: 'CS.PA', sector: 'Finance', type: 'Action' },
  'FR0000124141': { name: 'Veolia', ticker: 'VIE.PA', sector: 'Services', type: 'Action' },
  'FR0000120503': { name: 'Bouygues', ticker: 'EN.PA', sector: 'Industrie', type: 'Action' },
  'FR0010527275': { name: 'Amundi MSCI World PEA', ticker: 'CW8.PA', sector: 'Monde', type: 'ETF' },
  'FR0013412285': { name: 'Amundi CAC 40 PEA', ticker: 'C40.PA', sector: 'France', type: 'ETF' },
  'LU1681043599': { name: 'Lyxor Core MSCI World PEA', ticker: 'LCWD.PA', sector: 'Monde', type: 'ETF' },
  'FR0011550185': { name: 'Amundi MSCI World UCITS ETF', ticker: 'AMERW.PA', sector: 'Monde', type: 'ETF' },
  'DK0062498333': { name: 'Novo Nordisk', ticker: 'NOV.DE', fallbacks: ['NVO', 'NOVO-B.CO'], sector: 'Santé', type: 'Action' },
  'US0231351067': { name: 'Amazon', ticker: 'AMZN', sector: 'Technologie', type: 'Action' },
  'US5949181045': { name: 'Microsoft', ticker: 'MSFT', sector: 'Technologie', type: 'Action' },
  'US0378331005': { name: 'Apple', ticker: 'AAPL', sector: 'Technologie', type: 'Action' },
  'US67066G1040': { name: 'NVIDIA', ticker: 'NVDA', sector: 'Technologie', type: 'Action' },
};

// Certains ETF Euronext sont cotés en centimes d'euro par Alpha Vantage.
// Si le ticker est .PA ou .DE et que le prix semble en centimes (> 500),
// on vérifie si diviser par 100 donne une valeur plausible (entre 1 et 500).
function normalizeCentimes(price, ticker) {
  const isEuropean = ticker.includes('.PA') || ticker.includes('.DE') || ticker.includes('.AMS');
  if (isEuropean && price > 500) {
    const divided = price / 100;
    if (divided >= 1 && divided <= 500) return divided;
  }
  return price;
}

async function getQuote(ticker) {
  if (!KEY) return null;
  try {
    const url = `${AV_BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(KEY)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    const raw = Number(data?.['Global Quote']?.['05. price']);
    if (!raw || raw <= 0) return null;
    const price = normalizeCentimes(raw, ticker);
    return { price, ticker };
  } catch { return null; }
}

async function getQuoteWithFallbacks(ticker, fallbacks = []) {
  const all = [ticker, ...(fallbacks || [])];
  for (const t of all) {
    const q = await getQuote(t);
    if (q) return q;
  }
  return null;
}

async function resolveViaOpenFIGI(isin) {
  try {
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
      cache: 'no-store',
    });
    const data = await res.json();
    const matches = data?.[0]?.data;
    if (!matches?.length) return null;
    const preferred =
      matches.find(m => m.exchCode === 'PA') ||
      matches.find(m => m.exchCode === 'GY') ||
      matches.find(m => ['UN','UP','UA','UW','US'].includes(m.exchCode)) ||
      matches[0];
    return {
      name: preferred.name || preferred.securityDescription || isin,
      ticker: preferred.ticker,
      exchCode: preferred.exchCode,
      type: preferred.securityType2 === 'ETF' ? 'ETF' : 'Action',
    };
  } catch { return null; }
}

function buildAvTicker(ticker, exchCode) {
  const map = { PA: '.PA', GY: '.DE', LN: '.LON', SW: '.SWX', AS: '.AMS', MI: '.MIL', MC: '.MC', HK: '.HK', TO: '.TRT' };
  if (!exchCode) return ticker;
  const suffix = map[exchCode];
  if (!suffix || ticker.includes('.')) return ticker;
  return ticker + suffix;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const isin = searchParams.get('isin')?.toUpperCase()?.trim();
  if (!isin || isin.length < 10) return Response.json({ error: 'ISIN invalide.' }, { status: 400 });

  // 1. Mapping manuel
  if (KNOWN[isin]) {
    const k = KNOWN[isin];
    const quote = await getQuoteWithFallbacks(k.ticker, k.fallbacks);
    return Response.json({
      name: k.name, ticker: quote?.ticker ?? k.ticker, isin,
      price: quote?.price ?? 0,
      sector: k.sector, type: k.type,
      source: quote ? 'alphavantage' : 'mock',
    });
  }

  // 2. OpenFIGI
  const figi = await resolveViaOpenFIGI(isin);
  if (figi) {
    const avTicker = buildAvTicker(figi.ticker, figi.exchCode);
    const quote = await getQuote(avTicker);
    return Response.json({
      name: figi.name, ticker: quote?.ticker ?? avTicker, isin,
      price: quote?.price ?? 0,
      sector: 'Autre', type: figi.type,
      source: quote ? 'openfigi+alphavantage' : 'openfigi',
    });
  }

  // 3. Fallback Alpha Vantage SYMBOL_SEARCH
  if (KEY) {
    try {
      const url = `${AV_BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(isin)}&apikey=${encodeURIComponent(KEY)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      const match = data?.bestMatches?.[0];
      if (match) {
        const ticker = match['1. symbol'];
        const name = match['2. name'];
        const type = match['3. type'] === 'ETF' ? 'ETF' : 'Action';
        const quote = await getQuote(ticker);
        return Response.json({ name, ticker, isin, price: quote?.price ?? 0, sector: 'Autre', type, source: 'alphavantage-search' });
      }
    } catch {}
  }

  return Response.json({ error: `ISIN ${isin} introuvable. Ajoute-le manuellement dans app/api/isin/route.js.` }, { status: 404 });
}
