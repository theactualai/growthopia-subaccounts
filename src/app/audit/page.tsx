import { listAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export default function Audit() {
  const events = listAudit();
  return (
    <>
      <h1>Audit log</h1>
      <p className="sub">Every privileged action, including each time a 2FA code was viewed.</p>
      <div className="card scroll">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Resource</th><th>Detail</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.at).toLocaleString()}</td>
                <td>{e.actor}</td>
                <td><span className="pill">{e.action}</span></td>
                <td className="muted">{e.resource}</td>
                <td className="muted">{e.detail ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">In-memory for the preview, so it resets on redeploy. In Supabase this is an insert-only table.</p>
    </>
  );
}
