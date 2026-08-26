'use client';
import { useState } from 'react';
import { Assumptions, DEFAULTS, buildModel, phoneCosts, profilesPerClient, identitiesPerClient } from '@/lib/cost';

const money = (n: number) => `$${n.toFixed(2)}`;

export default function Model() {
  const [a, setA] = useState<Assumptions>(DEFAULTS);
  const set = <K extends keyof Assumptions>(k: K, v: Assumptions[K]) => setA({ ...a, [k]: v });
  const rows = buildModel(a);
  const phone = phoneCosts(a);

  return (
    <>
      <div className="card">
        <div className="grid">
          <label>Billing term<br />
            <select value={a.billing} onChange={(e) => set('billing', e.target.value as any)}>
              <option value="annual">Annual</option><option value="monthly">Monthly</option>
            </select>
          </label>
          <label>Phone strategy<br />
            <select value={a.phoneStrategy} onChange={(e) => set('phoneStrategy', e.target.value as any)}>
              <option value="A">A - one-time codes only</option>
              <option value="B">B - codes + retained rentals</option>
              <option value="C">C - full rental, every account</option>
              <option value="D">D - rent for setup, then release</option>
            </select>
          </label>
          <label>Accounts per platform<br />
            <input type="number" min={1} max={10} value={a.accountsPerPlatform}
              onChange={(e) => set('accountsPerPlatform', Number(e.target.value))} />
          </label>
          <label>Max profiles per identity<br />
            <input type="number" min={1} max={20} value={a.maxProfilesPerIdentity}
              onChange={(e) => set('maxProfilesPerIdentity', Number(e.target.value))} />
          </label>
          <label>Client lifetime (months)<br />
            <input type="number" min={1} max={60} value={a.clientLifetimeMonths}
              onChange={(e) => set('clientLifetimeMonths', Number(e.target.value))} />
          </label>
          <label>Budget ceiling $<br />
            <input type="number" min={1} value={a.budgetCeiling}
              onChange={(e) => set('budgetCeiling', Number(e.target.value))} />
          </label>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {profilesPerClient(a)} profiles per client · {identitiesPerClient(a)} identity/identities ·
          {' '}A {money(phone.A)} · B {money(phone.B)} · C {money(phone.C)} · D {money(phone.D)} per client/month
        </p>
      </div>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th className="num">Clients</th><th className="num">Profiles</th><th className="num">Identities</th>
              <th>GoLogin plan</th><th className="num">GoLogin</th><th className="num">Proxy</th>
              <th className="num">Infra</th><th className="num">Phone</th><th className="num">Total</th>
              <th className="num">Agency / mo</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.clients}>
                <td className="num">{r.clients}</td>
                <td className="num">{r.socialProfiles}</td>
                <td className="num">{r.identities}</td>
                <td className="muted">{r.goLoginPlan}</td>
                <td className="num">{money(r.goLoginPerClient)}</td>
                <td className="num">{money(r.proxyPerClient)}</td>
                <td className="num">{money(r.infra)}</td>
                <td className="num">{money(r.phone)}</td>
                <td className="num"><b>{money(r.total)}</b></td>
                <td className="num">{money(r.agencyMonthly)}</td>
                <td><span className={`pill ${r.underCeiling ? 'ok' : 'warn'}`}>{r.underCeiling ? 'ok' : 'over'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
