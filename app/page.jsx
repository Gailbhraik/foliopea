"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { summarize, fmt } from '../lib/compute';

const EMPTY = { isin: '', qty: '' };

export default function Home() {
  const [portfolio, setPortfolio] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem('foliopea'); if (raw) setPortfolio(JSON.parse(raw)); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('foliopea', JSON.stringify(portfolio));
  }, [portfolio, ready]);

  const { computed, total, perf, cash } = useMemo(() => summarize(portfolio), [portfolio]);

  const save = async () => {
    if (!form.isin || !form.qty) { setError('Remplis les deux champs.'); return; }
    if (portfolio.find(r => r.isin === form.isin.trim().toUpperCase())) { setError('Ce titre est déjà dans ton portfolio.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/isin?isin=${encodeURIComponent(form.isin.trim().toUpperCase())}`);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'ISIN introuvable.'); setLoading(false); return; }
      const row = { id: form.isin.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'), isin: form.isin.trim().toUpperCase(), qty: Number(form.qty), pru: data.price, price: data.price, name: data.name, ticker: data.ticker, sector: data.sector || 'Autre', type: data.type || 'Action', buys: [], dividends: [] };
      setPortfolio(p => [...p, row]);
      setForm(EMPTY); setShowForm(false);
    } catch { setError('Erreur réseau, réessaie.'); }
    setLoading(false);
  };

  const remove = (i) => setPortfolio(p => p.filter((_, j) => j !== i));
  const cancel = () => { setForm(EMPTY); setError(''); setShowForm(false); };

  const exportCSV = () => {
    const headers = 'name,ticker,isin,qty,pru,price,sector,type';
    const rows = portfolio.map(r => [r.name, r.ticker, r.isin, r.qty, r.pru, r.price, r.sector, r.type].join(','));
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'foliopea.csv'; a.click();
  };

  return (
    <main style={page}>
      <div style={wrap}>
        <header style={topBar}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px,4vw,44px)' }}>FolioPEA</h1>
            <p style={{ color: '#8ea2c6', margin: '6px 0 0' }}>Ton portefeuille PEA · {portfolio.length} ligne{portfolio.length > 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setShowForm(v => !v)} style={btn}>+ Ajouter un titre</button>
            {portfolio.length > 0 && <button onClick={exportCSV} style={btnOut}>Export CSV</button>}
          </div>
        </header>

        {showForm && (
          <div style={formCard}>
            <div style={formHead}>
              <strong>Ajouter un titre à ton PEA</strong>
              <button onClick={cancel} style={closeBtn}>✕</button>
            </div>
            <div style={{ padding: 24, display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={lbl}>
                  ISIN *
                  <input
                    type="text"
                    value={form.isin}
                    onChange={e => setForm(f => ({ ...f, isin: e.target.value.toUpperCase() }))}
                    placeholder="ex: FR0000120073"
                    style={input}
                    maxLength={12}
                  />
                  <span style={{ color: '#8ea2c6', fontSize: 11 }}>Code à 12 caractères sur ton relevé de courtier</span>
                </label>
                <label style={lbl}>
                  Nombre de parts *
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                    placeholder="ex: 35"
                    style={input}
                  />
                  <span style={{ color: '#8ea2c6', fontSize: 11 }}>Quantité de titres détenus</span>
                </label>
              </div>
              {error && <div style={{ color: '#fb7185', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={cancel} style={btnOut}>Annuler</button>
                <button onClick={save} style={btn} disabled={loading}>
                  {loading ? 'Recherche...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: 16 }} />

        <section style={grid}>
          {[['Valeur totale', fmt(total)], ['Plus-value', fmt(perf)], ['Cash', fmt(cash)], ['Positions', computed.length]].map(([a, b]) => (
            <div key={a} style={card}>
              <div style={{ padding: 20 }}>
                <div style={{ color: '#8ea2c6', fontSize: 13 }}>{a}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>{b}</div>
              </div>
            </div>
          ))}
        </section>

        <div style={{ height: 16 }} />

        {portfolio.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 48, color: '#8ea2c6' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 18, color: '#e8eefc', marginBottom: 8 }}>Ton portefeuille est vide.</div>
            <div>Clique sur <strong>+ Ajouter un titre</strong> et entre un ISIN + une quantité pour commencer.</div>
          </div>
        ) : (
          <div style={card}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #20324d', display: 'flex', justifyContent: 'space-between' }}>
              <strong>Portefeuille</strong>
              <span style={{ color: '#8ea2c6', fontSize: 13 }}>{computed.length} ligne{computed.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 10 }}>
              {computed.map((r, i) => (
                <div key={r.id || i} style={rowWrap}>
                  <Link href={`/portfolio/${r.id}`} style={rowLink}>
                    <div>
                      <strong>{r.name}</strong>
                      <div style={{ color: '#8ea2c6', fontSize: 12 }}>{r.isin} · {r.ticker} · {r.sector}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong>{fmt(r.value)}</strong>
                      <div style={{ color: r.perf >= 0 ? '#6ee7b7' : '#fb7185', fontSize: 12 }}>
                        {fmt(r.perf)} ({r.perfPct.toFixed(2)}%)
                      </div>
                    </div>
                  </Link>
                  <button onClick={() => remove(i)} style={{ ...iconBtn, color: '#fb7185', marginRight: 12 }}>🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 24 }} />
        <div style={{ color: '#4a6080', fontSize: 12, textAlign: 'center' }}>Données stockées localement · Aucune donnée envoyée</div>
      </div>
    </main>
  );
}

const page = { minHeight: '100vh', background: 'radial-gradient(circle at top,#11213b 0,#07111f 45%,#050a12 100%)', color: '#e8eefc', fontFamily: 'Inter,system-ui,sans-serif', padding: '28px' };
const wrap = { maxWidth: 1080, margin: '0 auto' };
const topBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 22, flexWrap: 'wrap' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 };
const card = { background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02))', border: '1px solid #20324d', borderRadius: 22, boxShadow: '0 20px 50px rgba(0,0,0,.35)', overflow: 'hidden' };
const formCard = { background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03))', border: '1px solid #34d399', borderRadius: 22, overflow: 'hidden', marginTop: 16 };
const formHead = { padding: '18px 20px', borderBottom: '1px solid #20324d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const input = { padding: '12px 14px', borderRadius: 14, border: '1px solid #20324d', background: 'rgba(255,255,255,.06)', color: '#e8eefc', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 8, color: '#8ea2c6', fontSize: 13 };
const btn = { padding: '12px 20px', borderRadius: 14, border: 'none', background: '#34d399', color: '#07111f', fontWeight: 700, cursor: 'pointer' };
const btnOut = { padding: '12px 20px', borderRadius: 14, border: '1px solid #20324d', background: 'transparent', color: '#e8eefc', fontWeight: 600, cursor: 'pointer' };
const closeBtn = { border: 'none', background: 'transparent', color: '#8ea2c6', fontSize: 18, cursor: 'pointer' };
const rowWrap = { display: 'flex', alignItems: 'center', border: '1px solid #20324d', borderRadius: 16, background: 'rgba(255,255,255,.03)' };
const rowLink = { flex: 1, display: 'flex', justifyContent: 'space-between', padding: '14px 16px', textDecoration: 'none', color: 'inherit' };
const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, padding: '4px 8px' };
