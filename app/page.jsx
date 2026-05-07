"use client";
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { summarize, fmtAuto, fmt, enrich } from '../lib/compute';

const EMPTY = { isin: '', qty: '', pru: '' };

const SECTOR_COLORS = {
  'Technologie': '#6366f1', 'Finance': '#3b82f6', 'Santé': '#10b981',
  'Consommation': '#f59e0b', 'Énergie': '#ef4444', 'Industrie': '#8b5cf6',
  'Services': '#06b6d4', 'Monde': '#ec4899', 'France': '#14b8a6',
  'USA': '#f97316', 'Luxe': '#a855f7', 'Autre': '#64748b',
};

function TypeBadge({ type }) {
  return <span className={`badge ${type === 'ETF' ? 'badge-blue' : 'badge-gold'}`}>{type}</span>;
}

function PerfBadge({ pct }) {
  const pos = pct >= 0;
  return <span className={`badge ${pos ? 'badge-green' : 'badge-red'}`}>{pos ? '+' : ''}{pct.toFixed(2)}%</span>;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1a2236 100%)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 24px', flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#e2e8f0', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

function SectorBar({ bySector, total }) {
  const entries = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden', gap: 2, marginBottom: 16 }}>
        {entries.map(([s, v]) => (
          <div key={s} style={{ flex: v / total, background: SECTOR_COLORS[s] || '#64748b', minWidth: 2 }} title={`${s}: ${((v/total)*100).toFixed(1)}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
        {entries.map(([s, v]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: SECTOR_COLORS[s] || '#64748b', flexShrink: 0 }} />
            <span style={{ color: '#94a3b8' }}>{s}</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{((v/total)*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Modal({ open, onClose, children }) {
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }} className="fade-in">
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const [portfolio, setPortfolio] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState('positions');

  useEffect(() => {
    try { const raw = localStorage.getItem('foliopea'); if (raw) setPortfolio(JSON.parse(raw)); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('foliopea', JSON.stringify(portfolio));
  }, [portfolio, ready]);

  const { computed, total, perf, cost, bySector } = useMemo(() => summarize(portfolio), [portfolio]);
  const perfPct = cost > 0 ? (perf / cost) * 100 : 0;

  const refreshPrices = useCallback(async () => {
    if (!portfolio.length) return;
    setRefreshing(true);
    const updated = await Promise.all(
      portfolio.map(async r => {
        try {
          const res = await fetch(`/api/isin?isin=${encodeURIComponent(r.isin)}`);
          const data = await res.json();
          if (res.ok && data.price > 0) return { ...r, price: data.price };
        } catch {}
        return r;
      })
    );
    setPortfolio(updated);
    setLastUpdate(new Date());
    setRefreshing(false);
  }, [portfolio]);

  const save = async () => {
    if (!form.isin || !form.qty) { setError('ISIN et quantité obligatoires.'); return; }
    if (portfolio.find(r => r.isin === form.isin.trim().toUpperCase())) { setError('Ce titre est déjà dans le portfolio.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/isin?isin=${encodeURIComponent(form.isin.trim().toUpperCase())}`);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'ISIN introuvable.'); setLoading(false); return; }
      const marketPrice = data.price;
      const pru = form.pru ? Number(form.pru) : marketPrice;
      const row = {
        id: form.isin.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
        isin: form.isin.trim().toUpperCase(),
        qty: Number(form.qty),
        pru, price: marketPrice,
        name: data.name, ticker: data.ticker,
        sector: data.sector || 'Autre',
        type: data.type || 'Action',
        currency: data.currency || 'EUR',
        buys: [], dividends: [],
      };
      setPortfolio(p => [...p, row]);
      setLastUpdate(new Date());
      setForm(EMPTY); setShowModal(false);
    } catch { setError('Erreur réseau.'); }
    setLoading(false);
  };

  const remove = i => setPortfolio(p => p.filter((_, j) => j !== i));

  const exportCSV = () => {
    const h = 'name,ticker,isin,qty,pru,price,currency,sector,type';
    const rows = portfolio.map(r => [r.name, r.ticker, r.isin, r.qty, r.pru, r.price, r.currency, r.sector, r.type].join(','));
    const blob = new Blob([[h, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'foliopea.csv'; a.click();
  };

  const fmtTime = d => d?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const topPos = [...computed].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0b0f1a' }}>
      {/* SIDEBAR */}
      <aside style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', background: '#0d1220' }}>
        <div style={{ padding: '28px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📈</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>FolioPEA</div>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>Dashboard</div>
            </div>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['📊', 'Vue d\'ensemble', 'home'], ['💼', 'Portefeuille', 'portfolio'], ['📉', 'Performance', 'perf'], ['⚙️', 'Paramètres', 'settings']].map(([icon, label, id]) => (
              <button key={id} onClick={() => setActiveTab(id === 'home' ? 'positions' : id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: 'none', background: (activeTab === 'positions' && id === 'home') || activeTab === id ? 'rgba(99,102,241,0.15)' : 'transparent', color: (activeTab === 'positions' && id === 'home') || activeTab === id ? '#818cf8' : '#64748b', cursor: 'pointer', fontSize: 14, fontWeight: 500, textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                <span style={{ fontSize: 16 }}>{icon}</span>{label}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ marginTop: 'auto', padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 11, color: '#334155', marginBottom: 6 }}>Dernière MAJ</div>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{lastUpdate ? fmtTime(lastUpdate) : 'Jamais'}</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: 'auto', padding: '32px 36px' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Vue d’ensemble</h1>
            <p style={{ fontSize: 13, color: '#475569' }}>{portfolio.length} position{portfolio.length > 1 ? 's' : ''} · PEA</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {portfolio.length > 0 && (
              <button className="btn-ghost" onClick={refreshPrices} disabled={refreshing}>
                <span style={{ fontSize: 14 }}>{refreshing ? '⏳' : '🔄'}</span>
                {refreshing ? 'Mise à jour...' : 'Actualiser'}
              </button>
            )}
            {portfolio.length > 0 && <button className="btn-ghost" onClick={exportCSV}><span>↓</span> Export CSV</button>}
            <button className="btn-primary" onClick={() => { setForm(EMPTY); setError(''); setShowModal(true); }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Ajouter
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard label="Valeur totale" value={fmt(total)} sub={`Investi : ${fmt(cost)}`} />
          <StatCard
            label="Plus-value"
            value={fmt(perf)}
            sub={`${perf >= 0 ? '+' : ''}${perfPct.toFixed(2)}% depuis l’achat`}
            color={perf >= 0 ? '#10b981' : '#ef4444'}
          />
          <StatCard label="Positions" value={computed.length} sub={`${computed.filter(r => r.type === 'ETF').length} ETF · ${computed.filter(r => r.type !== 'ETF').length} Actions`} />
          <StatCard
            label="Meilleure perf"
            value={topPos[0] ? `+${topPos[0]?.perfPct?.toFixed(1)}%` : '—'}
            sub={topPos[0]?.name || ''}
            color="#10b981"
          />
        </div>

        {portfolio.length === 0 ? (
          <div className="fade-in" style={{ background: '#111827', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 20, padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>📊</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Portfolio vide</div>
            <div style={{ color: '#475569', fontSize: 14, marginBottom: 28, maxWidth: 360, margin: '0 auto 28px' }}>Ajoute ton premier titre en entrant un code ISIN et une quantité.</div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>+ Ajouter un titre</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

            {/* POSITIONS TABLE */}
            <div>
              <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Positions</span>
                  <span style={{ fontSize: 12, color: '#475569' }}>{computed.length} ligne{computed.length > 1 ? 's' : ''}</span>
                </div>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Titre', 'Cours', 'Valeur', 'Performance', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>
                {computed.map((r, i) => (
                  <div key={r.id || i} className="hover-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', cursor: 'pointer' }}>
                    <Link href={`/portfolio/${r.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'contents' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${SECTOR_COLORS[r.sector] || '#64748b'}22`, border: `1px solid ${SECTOR_COLORS[r.sector] || '#64748b'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: SECTOR_COLORS[r.sector] || '#64748b', flexShrink: 0 }}>
                          {r.ticker?.replace('.PA','').replace('.DE','').slice(0,3)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{r.name}</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#475569' }}>{r.qty} parts</span>
                            <TypeBadge type={r.type} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtAuto(r.price, r.currency)}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>PRU {fmtAuto(r.pru, r.currency)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtAuto(r.value, r.currency)}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{((r.value/total)*100).toFixed(1)}% du portef.</div>
                      </div>
                      <div>
                        <PerfBadge pct={r.perfPct} />
                        <div style={{ fontSize: 11, color: r.perf >= 0 ? '#059669' : '#dc2626', marginTop: 4 }}>
                          {r.perf >= 0 ? '+' : ''}{fmtAuto(r.perf, r.currency)}
                        </div>
                      </div>
                    </Link>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => remove(i)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 13, transition: 'all 0.15s' }} title="Supprimer">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Répartition sectorielle */}
              <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '20px 24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>Répartition</div>
                <SectorBar bySector={bySector} total={total} />
              </div>

              {/* Top positions */}
              <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '20px 24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Top positions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topPos.map((r, i) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1a2236', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6366f1', fontWeight: 700 }}>#{i+1}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: '#475569' }}>{((r.value/total)*100).toFixed(1)}% du portef.</div>
                        </div>
                      </div>
                      <PerfBadge pct={r.perfPct} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Investissement */}
              <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 18, padding: '20px 24px' }}>
                <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Résumé</div>
                {[['Investi', fmt(cost)], ['Valeur actuelle', fmt(total)], ['Plus-value', `${perf >= 0 ? '+' : ''}${fmt(perf)}`], ['Rendement', `${perf >= 0 ? '+' : ''}${perfPct.toFixed(2)}%`]].map(([l, v], i) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: l === 'Plus-value' || l === 'Rendement' ? (perf >= 0 ? '#10b981' : '#ef4444') : '#e2e8f0' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL AJOUT */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setError(''); setForm(EMPTY); }}>
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Ajouter un titre</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Entre l’ISIN de ton titre pour l’ajouter au portfolio</div>
          </div>
          <button onClick={() => { setShowModal(false); setError(''); }} style={{ border: 'none', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Code ISIN *</label>
              <input
                type="text" value={form.isin} maxLength={12}
                onChange={e => setForm(f => ({ ...f, isin: e.target.value.toUpperCase() }))}
                placeholder="FR0000120073"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#1a2236', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Nb de parts *</label>
              <input
                type="number" min="0" step="any" value={form.qty}
                onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                placeholder="26"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#1a2236', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Prix de revient unitaire <span style={{ color: '#334155' }}>(optionnel)</span></label>
            <input
              type="number" min="0" step="any" value={form.pru}
              onChange={e => setForm(f => ({ ...f, pru: e.target.value }))}
              placeholder="Laisse vide pour utiliser le cours actuel"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#1a2236', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
            />
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn-ghost" onClick={() => { setShowModal(false); setError(''); }}>Annuler</button>
            <button className="btn-primary" onClick={save} disabled={loading}>{loading ? '⏳ Recherche...' : 'Ajouter le titre'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
