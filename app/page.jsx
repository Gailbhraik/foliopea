"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { summarize, fmt } from '../lib/compute';

const EMPTY = { name: '', ticker: '', isin: '', qty: '', pru: '', price: '', sector: 'Autre', type: 'Action' };
const SECTORS = ['Industrie', 'Énergie', 'Finance', 'Luxe', 'Technologie', 'Santé', 'Monde', 'Autre'];
const TYPES = ['Action', 'ETF'];

export default function Home() {
  const [portfolio, setPortfolio] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
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

  const save = () => {
    if (!form.name || !form.ticker) return;
    const row = { ...form, id: form.name.toLowerCase().replace(/\s+/g, '-'), qty: Number(form.qty), pru: Number(form.pru), price: Number(form.price), buys: [], dividends: [] };
    if (editing !== null) {
      setPortfolio(p => p.map((r, i) => i === editing ? row : r));
      setEditing(null);
    } else {
      setPortfolio(p => [...p, row]);
    }
    setForm(EMPTY);
    setShowForm(false);
  };

  const edit = (i) => { setForm(portfolio[i]); setEditing(i); setShowForm(true); };
  const remove = (i) => setPortfolio(p => p.filter((_, j) => j !== i));
  const cancel = () => { setForm(EMPTY); setEditing(null); setShowForm(false); };

  const importCSV = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    const [hdr, ...lines] = text.trim().split(/\r?\n/);
    const cols = hdr.split(',').map(s => s.trim());
    const next = lines.map((line, i) => {
      const vals = line.split(',');
      const r = Object.fromEntries(cols.map((c, j) => [c, vals[j]?.trim() ?? '']));
      return { id: (r.name||'ligne').toLowerCase().replace(/\s+/g,'-')+'-'+i, name: r.name||'Sans nom', ticker: r.ticker||'', isin: r.isin||'', qty: Number(r.qty||0), pru: Number(r.pru||0), price: Number(r.price||0), sector: r.sector||'Autre', type: r.type||'Action', buys: [], dividends: [] };
    });
    setPortfolio(next);
  };

  const exportCSV = () => {
    const headers = 'name,ticker,isin,qty,pru,price,sector,type';
    const rows = portfolio.map(r => [r.name,r.ticker,r.isin,r.qty,r.pru,r.price,r.sector,r.type].join(','));
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
            <button onClick={() => setShowForm(v => !v)} style={btn}>+ Ajouter une ligne</button>
            <button onClick={exportCSV} style={btnOut}>Export CSV</button>
            <label style={btnOut}>Import CSV<input type="file" accept=".csv" onChange={importCSV} style={{ display: 'none' }} /></label>
          </div>
        </header>

        {showForm && (
          <div style={formCard}>
            <div style={formHead}><strong>{editing !== null ? 'Modifier la ligne' : 'Ajouter une ligne'}</strong><button onClick={cancel} style={closeBtn}>✕</button></div>
            <div style={formGrid}>
              {[['Nom *', 'name', 'text'], ['Ticker *', 'ticker', 'text'], ['ISIN', 'isin', 'text'], ['Quantité *', 'qty', 'number'], ['PRU (€) *', 'pru', 'number'], ['Cours actuel (€)', 'price', 'number']].map(([label, key, type]) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#8ea2c6', fontSize: 13 }}>
                  {label}
                  <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={input} placeholder={label} />
                </label>
              ))}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#8ea2c6', fontSize: 13 }}>
                Secteur
                <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} style={input}>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#8ea2c6', fontSize: 13 }}>
                Type
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={input}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={cancel} style={btnOut}>Annuler</button>
              <button onClick={save} style={btn}>{editing !== null ? 'Mettre à jour' : 'Ajouter'}</button>
            </div>
          </div>
        )}

        <div style={{ height: 16 }} />

        <section style={grid}>
          {[['Valeur totale', fmt(total)], ['Plus-value', fmt(perf)], ['Cash', fmt(cash)], ['Positions', computed.length]].map(([a, b]) => (
            <div key={a} style={card}><div style={{ padding: 20 }}><div style={{ color: '#8ea2c6', fontSize: 13 }}>{a}</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>{b}</div></div></div>
          ))}
        </section>

        <div style={{ height: 16 }} />

        {portfolio.length === 0 ? (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: '#8ea2c6' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Ton portefeuille est vide.</div>
            <div>Clique sur « + Ajouter une ligne » ou importe un fichier CSV pour commencer.</div>
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
                      <div style={{ color: '#8ea2c6', fontSize: 12 }}>{r.ticker} · {r.sector} · {r.type}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong>{fmt(r.value)}</strong>
                      <div style={{ color: r.perf >= 0 ? '#6ee7b7' : '#fb7185', fontSize: 12 }}>{fmt(r.perf)} ({r.perfPct.toFixed(2)}%)</div>
                    </div>
                  </Link>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                    <button onClick={() => edit(i)} style={iconBtn}>✏️</button>
                    <button onClick={() => remove(i)} style={{ ...iconBtn, color: '#fb7185' }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 24 }} />
        <div style={{ color: '#4a6080', fontSize: 12, textAlign: 'center' }}>Données stockées localement dans ton navigateur · Aucune donnée envoyée</div>
      </div>
    </main>
  );
}

const page = { minHeight: '100vh', background: 'radial-gradient(circle at top,#11213b 0,#07111f 45%,#050a12 100%)', color: '#e8eefc', fontFamily: 'Inter,system-ui,sans-serif', padding: '28px' };
const wrap = { maxWidth: 1080, margin: '0 auto' };
const topBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 22, flexWrap: 'wrap' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 };
const card = { background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02))', border: '1px solid #20324d', borderRadius: 22, boxShadow: '0 20px 50px rgba(0,0,0,.35)', overflow: 'hidden' };
const formCard = { background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03))', border: '1px solid #34d399', borderRadius: 22, boxShadow: '0 20px 50px rgba(0,0,0,.35)', overflow: 'hidden', marginTop: 16 };
const formHead = { padding: '18px 20px', borderBottom: '1px solid #20324d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const formGrid = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 };
const input = { padding: '12px 14px', borderRadius: 14, border: '1px solid #20324d', background: 'rgba(255,255,255,.06)', color: '#e8eefc', fontSize: 14, outline: 'none' };
const btn = { padding: '12px 18px', borderRadius: 14, border: 'none', background: '#34d399', color: '#07111f', fontWeight: 700, cursor: 'pointer' };
const btnOut = { padding: '12px 18px', borderRadius: 14, border: '1px solid #20324d', background: 'transparent', color: '#e8eefc', fontWeight: 600, cursor: 'pointer' };
const closeBtn = { border: 'none', background: 'transparent', color: '#8ea2c6', fontSize: 18, cursor: 'pointer' };
const rowWrap = { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #20324d', borderRadius: 16, background: 'rgba(255,255,255,.03)' };
const rowLink = { flex: 1, display: 'flex', justifyContent: 'space-between', padding: '14px 16px', textDecoration: 'none', color: 'inherit' };
const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, padding: '4px 8px' };
