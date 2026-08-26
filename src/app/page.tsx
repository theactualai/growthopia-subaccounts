import { clients, clientAccounts, clientIdentities, identities, proxies, phones } from '@/lib/store';
import { DEFAULTS, modelRow, profilesPerClient } from '@/lib/cost';

export default function Home() {
  const target = profilesPerClient(DEFAULTS);
  const row = modelRow(Math.max(clients.length, 5), DEFAULTS);
  const free = identities.filter((i) => !i.clientId).length;

  return (
    <>
      <h1>Clients</h1>
      <p className="sub">Every account, identity, proxy, number and address, mapped to the client who owns it.</p>

      <div className="grid" style={{ margin: '16px 0 6px' }}>
        <div className="stat"><b>{clients.length}</b><span>Active clients</span></div>
        <div className="stat"><b>{identities.length}</b><span>Identities ({free} unassigned)</span></div>
        <div className="stat"><b>{proxies.length}</b><span>Proxies</span></div>
        <div className="stat"><b>{phones.filter((p) => p.status === 'active').length}</b><span>Numbers held</span></div>
        <div className="stat"><b>${row.total.toFixed(2)}</b><span>Cost per client / month</span></div>
      </div>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Client</th><th>Primary handle</th><th>Status</th>
              <th className="num">Accounts</th><th className="num">Target</th>
              <th className="num">Identities</th><th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const acc = clientAccounts(c.id);
              const want = c.targetPerPlatform * DEFAULTS.platforms;
              return (
                <tr key={c.id}>
                  <td><a href={`/clients/${c.id}`}>{c.name}</a></td>
                  <td className="muted">@{c.primaryHandle}</td>
                  <td><span className={`pill ${c.status === 'active' ? 'ok' : ''}`}>{c.status}</span></td>
                  <td className="num">{acc.length}</td>
                  <td className="num">{want}</td>
                  <td className="num">{clientIdentities(c.id).length}</td>
                  <td>
                    <span className={`pill ${acc.length >= want ? 'ok' : 'warn'}`}>
                      {acc.length >= want ? 'complete' : `${want - acc.length} to provision`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">Target assumes {DEFAULTS.accountsPerPlatform} accounts on each of {DEFAULTS.platforms} platforms, so {target} per client.</p>
    </>
  );
}
