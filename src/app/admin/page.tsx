import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/session';
import { ALLOWED_DOMAIN, ADMIN_EMAILS } from '@/lib/auth';
import { clients, identities, proxies, phones, emails, accounts } from '@/lib/store';
import { listAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin');
  // Signed in and on-domain, but not an admin. Middleware lets them into the
  // app; this page is the second gate.
  if (!user.admin) redirect('/');

  const env = (k: string) => (process.env[k] ? 'set' : 'MISSING');
  const vendors = [
    ['Spaceship', 'SPACESHIP_API_KEY'],
    ['Cloudflare', 'CLOUDFLARE_API_TOKEN'],
    ['Webshare', 'WEBSHARE_API_KEY'],
    ['GoLogin', 'GOLOGIN_API_TOKEN'],
    ['Supabase', 'SUPABASE_SECRET_KEY'],
    ['Anthropic', 'ANTHROPIC_API_KEY'],
    ['TOTP encryption', 'TOTP_ENCRYPTION_KEY'],
  ] as const;

  return (
    <>
      <h1>Admin</h1>
      <p className="sub">Signed in as {user.email}</p>

      <h2>Access</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Setting</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Allowed sign-in domain</td><td><b>@{ALLOWED_DOMAIN}</b></td></tr>
            <tr><td>Admins</td><td>{ADMIN_EMAILS.join(', ')}</td></tr>
            <tr>
              <td>Everyone else</td>
              <td className="muted">Any other @{ALLOWED_DOMAIN} account can sign in and use the dashboard, but not see this page.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">Change these with the GOOGLE_ALLOWED_DOMAIN and ADMIN_EMAILS environment variables.</p>

      <h2>Vendor credentials</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Vendor</th><th>Environment variable</th><th>Status</th></tr></thead>
          <tbody>
            {vendors.map(([name, key]) => (
              <tr key={key}>
                <td>{name}</td>
                <td className="muted">{key}</td>
                <td>
                  <span className={`pill ${env(key) === 'set' ? 'ok' : 'warn'}`}>{env(key)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Presence only. Values are never read into the page.</p>

      <h2>Inventory</h2>
      <div className="grid">
        <div className="stat"><b>{clients.length}</b><span>Clients</span></div>
        <div className="stat"><b>{accounts.length}</b><span>Platform accounts</span></div>
        <div className="stat"><b>{identities.length}</b><span>Identities</span></div>
        <div className="stat"><b>{proxies.length}</b><span>Proxies</span></div>
        <div className="stat"><b>{phones.filter((p) => p.status === 'active').length}</b><span>Numbers held</span></div>
        <div className="stat"><b>{emails.length}</b><span>Email addresses</span></div>
      </div>

      <h2>Recent activity</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Resource</th></tr></thead>
          <tbody>
            {listAudit().slice(0, 10).map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.at).toLocaleString()}</td>
                <td>{e.actor}</td>
                <td><span className="pill">{e.action}</span></td>
                <td className="muted">{e.resource}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
