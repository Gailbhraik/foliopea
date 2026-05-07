const KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE = 'https://www.alphavantage.co/query';
export async function GET(req){ const { searchParams } = new URL(req.url); const q = searchParams.get('q') || ''; if(!KEY) return Response.json({ bestMatches: [] }); const url = `${BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${encodeURIComponent(KEY)}`; const res = await fetch(url, { cache:'no-store' }); const data = await res.json(); return Response.json(data); }
