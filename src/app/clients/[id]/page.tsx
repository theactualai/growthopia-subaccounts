import { notFound } from 'next/navigation';
import {
  getClient, clientAccounts, clientIdentities, clientPhones, clientEmails,
  proxyFor, secretFor, identityLoad, recycleState, identities,
} from '@/lib/store';
import { DEFAULTS } from '@/lib/cost';
import CodeButton from './CodeButton';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getClient(id);
  if (!client) notFound();

  const accounts = clientAccounts(id);
  const ids = clientIdentities(id);
  const pool = identities.filter((i) => !i.clientId);

  return (
    <>
      <h1>{client.name}</h1>
      <p className="sub">@{client.primaryHandle} · target {client.targetPerPlatform} per platform</p>

      <h2>Platform accounts</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Platform</th><th>Handle</th><th>Identity</th><th>Email</th><th>Number</th><th>2FA</th><th>Status</th><th>Code</th></tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const email = clientEmails(id).find((e) => e.id === a.emailId);
              const phone = clientPhones(id).find((p) => p.id === a.phoneId);
              return (
                <tr key={a.id}>
                  <td>{a.platform}</td>
                  <td>{a.handle}</td>
                  <td className="muted">{ids.find((i) => i.id === a.identityId)?.label ?? '—'}</td>
                  <td className="muted">{email?.address ?? '—'}</td>
                  <td className="muted">{phone?.masked ?? '—'}</td>
                  <td><span className={`pill ${a.twoFactor === 'authenticator' ? 'ok' : 'warn'}`}>{a.twoFactor}</span></td>
                  <td><span className={`pill ${a.status === 'live' ? 'ok' : 'warn'}`}>{a.status}</span></td>
                  <td><CodeButton accountId={a.id} enrolled={Boolean(secretFor(a.id))} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Identities and capacity</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Identity</th><th>GoLogin profile</th><th>Proxy</th><th className="num">Accounts</th><th>Capacity</th><th>Status</th></tr>
          </thead>
          <tbody>
            {ids.map((i) => {
              const load = identityLoad(i.id, DEFAULTS.maxProfilesPerIdentity);
              const px = proxyFor(i.proxyId);
              return (
                <tr key={i.id}>
                  <td>{i.label}</td>
                  <td className="muted">{i.goLoginProfileId}</td>
                  <td className="muted">{px ? `${px.ip} (${px.protocol})` : '—'}</td>
                  <td className="num">{load.used}</td>
                  <td>
                    <span className={`pill ${load.over ? 'warn' : 'ok'}`}>
                      {load.over ? `over by ${load.used - load.max}` : `${load.remaining} free of ${load.max}`}
                    </span>
                  </td>
                  <td><span className="pill">{i.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Identity pool</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Identity</th><th>Proxy</th><th>Released</th><th>Reusable</th></tr></thead>
          <tbody>
            {pool.map((i) => {
              const r = recycleState(i);
              return (
                <tr key={i.id}>
                  <td>{i.label}</td>
                  <td className="muted">{proxyFor(i.proxyId)?.ip ?? '—'}</td>
                  <td className="muted">{r.reason}</td>
                  <td>
                    <span className={`pill ${r.eligible ? 'ok' : 'warn'}`}>
                      {r.eligible ? 'ready to reuse' : `${r.daysLeft} days left`}
                    </span>
                  </td>
                </tr>
              );
            })}
            {pool.length === 0 && <tr><td colSpan={4} className="muted">Nothing in the pool.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted">Identities become reusable 30 days after release. Change the window in lib/store.ts.</p>
    </>
  );
}
