"use client";
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { summarize, fmtAuto, fmt } from '../lib/compute';

const EMPTY = { isin: '', qty: '', pru: '' };

const SECTOR_COLORS = {
  'Technologie': '#6366f1', 'Finance': '#3b82f6', 'Santé': '#10b981',
  'Consommation': '#f59e0b', 'Énergie': '#ef4444', 'Industrie': '#8b5cf6',
  'Services': '#06b6d4', 'Monde': '#ec4899', 'France': '#14b8a6',
  'USA': '#f97316', 'Luxe': '#a855f7', 'Autre': '#64748b',
};

const NAV_ITEMS = [
  { id: 'positions', icon: '📊', label: 'Accueil' },
  { id: 'portfolio', icon: '💼', label: 'Portfolio' },
  { id: 'perf', icon: '📉', label: 'Perf' },
  { id: 'settings', icon: '⚙️', label: 'Réglages' },
];

function TypeBadge({ type }) {
  return <span className={`badge ${type === 'ETF' ? 'badge-blue' : 'badge-gold'}`}>{type}</span>;
}
function PerfBadge({ pct }) {
  const pos = pct >= 0;
  return <span className={`badge ${pos ? 'badge-green' : 'badge-red'}`}>{pos ? '+' : ''}{pct.toFixed(2)}%</span>;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ background: 'linear-gradient(135deg,#111827,#1a2236)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 24px', flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#e2e8f0', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function SectorBar({ bySector, total }) {
  const entries = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
        {entries.map(([s, v]) => <div key={s} style={{ flex: v/total, background: SECTOR_COLORS[s]||'#64748b', minWidth: 2 }} title={`${s}: ${((v/total)*100).toFixed(1)}%`} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {entries.map(([s, v]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: SECTOR_COLORS[s]||'#64748b', flexShrink: 0 }} />
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0' }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, boxShadow: '0 -20px 60px rgba(0,0,0,0.6)', maxHeight: '95vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 68, background: 'rgba(13,18,32,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.08)', zIndex: 150, alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
      {NAV_ITEMS.map(({ id, icon, label }) => (
        <button key={id} onClick={() => onChange(id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 16px', border: 'none', background: 'transparent', color: active === id ? '#818cf8' : '#475569', cursor: 'pointer', fontSize: 10, fontWeight: active === id ? 700 : 500, transition: 'color 0.15s', minWidth: 60 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          {label}
        </button>
      ))}
    </nav>
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
  const perfPct = cost > 0 ? (perf/cost)*100 : 0;
  const topPos = useMemo(() => [...computed].sort((a,b) => b.value - a.value).slice(0,3), [computed]);

  const refreshPrices = useCallback(async () => {
    if (!portfolio.length) return;
    setRefreshing(true);
    const updated = await Promise.all(portfolio.map(async r => {
      try {
        const res = await fetch(`/api/isin?isin=${encodeURIComponent(r.isin)}`);
        const data = await res.json();
        if (res.ok && data.price > 0) return { ...r, price: data.price };
      } catch {}
      return r;
    }));
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
      const pru = form.pru ? Number(form.pru) : data.price;
      setPortfolio(p => [...p, {
        id: form.isin.trim().toLowerCase().replace(/[^a-z0-9]/g,'-'),
        isin: form.isin.trim().toUpperCase(),
        qty: Number(form.qty), pru, price: data.price,
        name: data.name, ticker: data.ticker,
        sector: data.sector||'Autre', type: data.type||'Action',
        currency: data.currency||'EUR', buys: [], dividends: [],
      }]);
      setLastUpdate(new Date());
      setForm(EMPTY); setShowModal(false);
    } catch { setError('Erreur réseau.'); }
    setLoading(false);
  };

  const remove = i => setPortfolio(p => p.filter((_,j) => j !== i));
  const exportCSV = () => {
    const h = 'name,ticker,isin,qty,pru,price,currency,sector,type';
    const rows = portfolio.map(r => [r.name,r.ticker,r.isin,r.qty,r.pru,r.price,r.currency,r.sector,r.type].join(','));
    const blob = new Blob([[h,...rows].join('\n')], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'foliopea.csv'; a.click();
  };

  const fmtTime = d => d?.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0b0f1a' }}>

      {/* SIDEBAR desktop */}
      <aside className="sidebar" style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', background: '#0d1220' }}>
        <div style={{ padding: '28px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📈</div>
            <div><div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>FolioPEA</div><div style={{ fontSize: 11, color: '#475569' }}>Dashboard</div></div>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV_ITEMS.map(({ id, icon, label }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: 'none', background: activeTab === id ? 'rgba(99,102,241,0.15)' : 'transparent', color: activeTab === id ? '#818cf8' : '#64748b', cursor: 'pointer', fontSize: 14, fontWeight: 500, textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
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
      <main className="main-pad" style={{ flex: 1, overflow: 'auto' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 3 }}>Vue d’ensemble</h1>
            <p style={{ fontSize: 13, color: '#475569' }}>{portfolio.length} position{portfolio.length > 1 ? 's' : ''} · PEA {lastUpdate && <span style={{ opacity: 0.6 }}>· MAJ {fmtTime(lastUpdate)}</span>}</p>
          </div>
          <div className="topbar-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {portfolio.length > 0 && (
              <button className="btn-ghost always" onClick={refreshPrices} disabled={refreshing} style={{ padding: '10px 14px' }}>
                <span>{refreshing ? '⏳' : '🔄'}</span>
                <span className="hide-xs">{refreshing ? 'MAJ...' : 'Actualiser'}</span>
              </button>
            )}
            {portfolio.length > 0 && <button className="btn-ghost" onClick={exportCSV} style={{ padding: '10px 14px' }}><span>↓</span><span className="hide-xs"> CSV</span></button>}
            <button className="btn-primary" onClick={() => { setForm(EMPTY); setError(''); setShowModal(true); }} style={{ padding: '10px 16px' }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span><span className="hide-xs"> Ajouter</span>
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <StatCard label="Valeur totale" value={fmt(total)} sub={`Investi : ${fmt(cost)}`} />
          <StatCard label="Plus-value" value={fmt(perf)} sub={`${perf>=0?'+':''}${perfPct.toFixed(2)}% depuis l’achat`} color={perf>=0?'#10b981':'#ef4444'} />
          <StatCard label="Positions" value={computed.length} sub={`${computed.filter(r=>r.type==='ETF').length} ETF · ${computed.filter(r=>r.type!=='ETF').length} Actions`} />
          <StatCard label="Meilleure perf" value={topPos[0] ? `${topPos[0].perfPct>=0?'+':''}${topPos[0].perfPct.toFixed(1)}%` : '—'} sub={topPos[0]?.name||''} color="#10b981" />
        </div>

        {portfolio.length === 0 ? (
          <div className="fade-in" style={{ background: '#111827', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 20, padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Portfolio vide</div>
            <div style={{ color: '#475569', fontSize: 14, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>Ajoute ton premier titre via son code ISIN.</div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>+ Ajouter un titre</button>
          </div>
        ) : (
          <div className="content-grid">

            {/* POSITIONS */}
            <div>
              <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Positions</span>
                  <span style={{ fontSize: 12, color: '#475569' }}>{computed.length} ligne{computed.length>1?'s':''}</span>
                </div>
                {/* En-tête tableau visible uniquement desktop */}
                <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 60px', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Titre','Cours','Valeur','Performance',''].map(h => (
                    <div key={h} style={{ fontSize: 11, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>
                {computed.map((r, i) => (
                  <div key={r.id||i} className="hover-row table-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 60px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                    {/* desktop : 5 colonnes via display:contents */}
                    <Link href={`/portfolio/${r.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'contents' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${SECTOR_COLORS[r.sector]||'#64748b'}22`, border: `1px solid ${SECTOR_COLORS[r.sector]||'#64748b'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: SECTOR_COLORS[r.sector]||'#64748b', flexShrink: 0 }}>
                          {r.ticker?.replace('.PA','').replace('.DE','').slice(0,3)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#475569' }}>{r.qty} parts</span>
                            <TypeBadge type={r.type} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtAuto(r.price,r.currency)}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>PRU {fmtAuto(r.pru,r.currency)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtAuto(r.value,r.currency)}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{((r.value/total)*100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <PerfBadge pct={r.perfPct} />
                        <div style={{ fontSize: 11, color: r.perf>=0?'#059669':'#dc2626', marginTop: 3 }}>{r.perf>=0?'+':''}{fmtAuto(r.perf,r.currency)}</div>
                      </div>
                    </Link>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => remove(i)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 13 }} title="Supprimer">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Répartition sectorielle</div>
                <SectorBar bySector={bySector} total={total} />
              </div>
              <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Top positions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {topPos.map((r,i) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: '#1a2236', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>#{i+1}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: '#475569' }}>{((r.value/total)*100).toFixed(1)}%</div>
                        </div>
                      </div>
                      <PerfBadge pct={r.perfPct} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 18, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Résumé PnL</div>
                {[['Investi',fmt(cost)],['Valeur',fmt(total)],['Plus-value',`${perf>=0?'+':''}${fmt(perf)}`],['Rendement',`${perf>=0?'+':''}${perfPct.toFixed(2)}%`]].map(([l,v],i) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i<3?'1px solid rgba(255,255,255,0.05)':'none' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: (l==='Plus-value'||l==='Rendement') ? (perf>=0?'#10b981':'#ef4444') : '#e2e8f0' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAV mobile */}
      <BottomNav active={activeTab} onChange={setActiveTab} />

      {/* MODAL bottom sheet */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setError(''); setForm(EMPTY); }}>
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div style={{ padding: '16px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Ajouter un titre</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Saisis l’ISIN pour rechercher automatiquement</div>
          </div>
          <button onClick={() => { setShowModal(false); setError(''); }} style={{ border: 'none', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '8px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="modal-grid">
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 7 }}>Code ISIN *</label>
              <input type="text" value={form.isin} maxLength={12} onChange={e => setForm(f => ({...f, isin: e.target.value.toUpperCase()}))} placeholder="FR0000120073" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'#1a2236', color:'#e2e8f0', fontSize:15, outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 7 }}>Nb de parts *</label>
              <input type="number" min="0" step="any" value={form.qty} onChange={e => setForm(f => ({...f, qty: e.target.value}))} placeholder="26" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'#1a2236', color:'#e2e8f0', fontSize:15, outline:'none' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 7 }}>PRU <span style={{ color:'#334155' }}>(optionnel — laisse vide pour utiliser le cours actuel)</span></label>
            <input type="number" min="0" step="any" value={form.pru} onChange={e => setForm(f => ({...f, pru: e.target.value}))} placeholder="Ex : 42.50" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'#1a2236', color:'#e2e8f0', fontSize:15, outline:'none' }} />
          </div>
          {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#f87171' }}>{error}</div>}
          <button className="btn-primary" onClick={save} disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'14px', fontSize:15 }}>{loading ? '⏳ Recherche en cours...' : 'Ajouter le titre'}</button>
          <button className="btn-ghost" onClick={() => { setShowModal(false); setError(''); }} style={{ width:'100%', justifyContent:'center' }}>Annuler</button>
        </div>
      </Modal>
    </div>
  );
}
