'use client';
import { useState } from 'react';

type Cell = { verdict: string; note?: string; url: string };
type Row = {
  handle: string; why: string; source: 'ai' | 'rules';
  platforms: Record<string, Cell>;
  noneTaken: boolean;
};

function dot(c?: Cell) {
  if (!c) return <span className="pill">?</span>;
  if (c.verdict === 'available') return <span className="pill ok">free</span>;
  if (c.verdict === 'taken') return <span className="pill warn">taken</span>;
  return <a className="pill" href={c.url} target="_blank" rel="noreferrer" title={c.note}>check</a>;
}

export default function Finder() {
  const [brand, setBrand] = useState('360 BnB Solutions');
  const [primaryHandle, setPrimary] = useState('360bnbsolutions');
  const [about, setAbout] = useState('Short-term rental and Airbnb management for property owners');
  const [keywords, setKeywords] = useState('hosting, cleaning, cohost, miami');
  const [rows, setRows] = useState<Row[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ provider?: string; aiError?: string | null }>({});
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true); setRows([]);
    const res = await fetch('/api/names', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, primaryHandle, about, keywords }),
    });
    const j = await res.json();
    setBusy(false);
    setRows(j.results ?? []); setEmails(j.emails ?? []);
    setMeta({ provider: j.provider, aiError: j.aiError });
  }

  return (
    <>
      <div className="card">
        <div className="grid">
          <label>Business name<br /><input value={brand} onChange={(e) => setBrand(e.target.value)} style={{ width: '100%' }} /></label>
          <label>Existing handle<br /><input value={primaryHandle} onChange={(e) => setPrimary(e.target.value)} style={{ width: '100%' }} /></label>
          <label>Service lines / formats / places<br /><input value={keywords} onChange={(e) => setKeywords(e.target.value)} style={{ width: '100%' }} /></label>
        </div>
        <label style={{ display: 'block', marginTop: 12 }}>What they do<br />
          <input value={about} onChange={(e) => setAbout(e.target.value)} style={{ width: '100%' }} />
        </label>
        <p style={{ marginTop: 12 }}>
          <button onClick={go} disabled={busy}>{busy ? 'Generating and checking…' : 'Find available handles'}</button>
          {meta.provider && <span className="muted"> · via {meta.provider === 'cli' ? 'local claude CLI' : meta.provider}</span>}
        </p>
        {meta.aiError && <p className="muted">AI step failed ({meta.aiError}). Showing rule-based ideas only.</p>}
      </div>

      {rows.length > 0 && (
        <div className="card scroll">
          <table>
            <thead><tr><th>Handle</th><th>Instagram</th><th>TikTok</th><th>YouTube</th><th>Why</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.handle} style={r.noneTaken ? { background: '#f4faf6' } : undefined}>
                  <td><b>{r.handle}</b></td>
                  <td>{dot(r.platforms.instagram)}</td>
                  <td>{dot(r.platforms.tiktok)}</td>
                  <td>{dot(r.platforms.youtube)}</td>
                  <td className="muted">{r.why}</td>
                  <td className="muted">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {emails.length > 0 && (
        <>
          <h2>Email ideas</h2>
          <div className="card scroll">
            <table>
              <thead><tr><th>Address</th><th>Shape</th><th>Note</th></tr></thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.address}>
                    <td>{e.address}</td>
                    <td>{e.valid ? <span className="pill ok">valid</span> : <span className="pill warn">invalid</span>}</td>
                    <td className="muted">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
