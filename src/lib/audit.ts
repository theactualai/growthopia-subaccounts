// Append-only audit trail. Pulling a 2FA code is effectively "someone signed in
// to this account", so it gets a row like any other privileged action.
//
// In-memory for the preview; in Supabase this is an insert-only table.

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  resource: string;
  detail?: string;
};

const events: AuditEvent[] = [
  { id: 'ev-1', at: new Date(Date.now() - 3600_000).toISOString(), actor: 'alex@growthopia', action: 'identity.assigned', resource: 'id-01', detail: 'to 360 BnB Solutions' },
  { id: 'ev-2', at: new Date(Date.now() - 1800_000).toISOString(), actor: 'alex@growthopia', action: 'proxy.allocated',   resource: 'px-01', detail: 'socks5' },
];

export const listAudit = () => [...events].sort((a, b) => b.at.localeCompare(a.at));

export function record(actor: string, action: string, resource: string, detail?: string) {
  events.push({ id: `ev-${events.length + 1}`, at: new Date().toISOString(), actor, action, resource, detail });
}
