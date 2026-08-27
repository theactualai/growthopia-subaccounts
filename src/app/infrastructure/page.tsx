import { runPreflight } from '@/lib/preflight';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export default async function Infrastructure() {
  let pf;
  let error: string | null = null;
  try { pf = await runPreflight(); } catch (e) { error = e instanceof Error ? e.message : 'check failed'; }

  if (error || !pf) {
    return (
      <>
        <h1>Infrastructure</h1>
        <div className="card"><p className="pill warn">Check failed: {error}</p></div>
      </>
    );
  }

  const blockers = pf.findings.filter((f) => f.severity === 'block');
  const warnings = pf.findings.filter((f) => f.severity === 'warn');

  return (
    <>
      <h1>Infrastructure</h1>
      <p className="sub">Live state from Webshare, GoLogin, Spaceship and Cloudflare. Checked {new Date(pf.checkedAt).toLocaleTimeString()}.</p>

      <div className="card" style={{ borderLeft: `4px solid ${pf.verdict === 'go' ? 'var(--ok)' : 'var(--warn)'}` }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>
          {pf.verdict === 'go' ? 'Ready to create accounts' : `Not ready — ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}`}
        </h2>
        {blockers.length === 0 && warnings.length === 0 && (
          <p className="muted" style={{ marginBottom: 0 }}>Every layer lines up.</p>
        )}
        {blockers.map((f, i) => (
          <p key={`b${i}`} style={{ margin: '10px 0 0' }}>
            <span className="pill warn">{f.area}</span> {f.message}
          </p>
        ))}
        {warnings.map((f, i) => (
          <p key={`w${i}`} className="muted" style={{ margin: '10px 0 0' }}>
            <span className="pill">{f.area}</span> {f.message}
          </p>
        ))}
      </div>

      <h2>Proxies</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Address</th><th>Location</th><th>Reputation</th><th>Bound to</th><th>Use area code</th></tr>
          </thead>
          <tbody>
            {pf.proxies.map((p) => (
              <tr key={`${p.address}:${p.port}`}>
                <td>{p.address}:{p.port}</td>
                <td className="muted">{p.city ?? '?'}, {p.country}</td>
                <td>
                  {p.flagged === null ? <span className="pill">unknown</span>
                    : p.flagged ? <span className="pill warn">flagged</span>
                    : <span className="pill ok">clean</span>}
                </td>
                <td className="muted">{p.boundTo ?? '—'}</td>
                <td className="muted">{p.areaCodes ? p.areaCodes.join(' / ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Reputation is an independent lookup, not Webshare&apos;s own label. A flagged IP cannot create accounts whatever the vendor dashboard says.</p>

      <h2>Browser profiles</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Profile</th><th>Protocol</th><th>Proxy</th><th>Where</th><th>Status</th></tr></thead>
          <tbody>
            {pf.profiles.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="muted">{p.protocol}</td>
                <td className="muted">{p.host ?? '—'}</td>
                <td className="muted">{p.where}</td>
                <td>{p.ok ? <span className="pill ok">ready</span> : <span className="pill warn">check</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Domains and email</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Domain</th><th>Zone</th><th>Routing</th><th>Catch-all</th></tr></thead>
          <tbody>
            {pf.domains.map((d) => (
              <tr key={d.domain}>
                <td>{d.domain}</td>
                <td>{d.zone === 'active' ? <span className="pill ok">active</span> : <span className="pill warn">{d.zone}</span>}</td>
                <td className="muted">{d.routing}</td>
                <td className="muted">{d.catchAll ?? <span className="pill warn">none</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Any address at an active domain works without being created first.</p>
    </>
  );
}
