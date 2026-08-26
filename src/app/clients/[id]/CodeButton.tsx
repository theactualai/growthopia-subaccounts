'use client';
import { useState } from 'react';

export default function CodeButton({ accountId, enrolled }: { accountId: string; enrolled: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!enrolled) return <span className="muted">no authenticator</span>;

  async function get() {
    setBusy(true);
    const res = await fetch('/api/totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.code) { setCode(j.code); setLeft(j.secondsLeft); }
  }

  return code ? (
    <span>
      <span className="code">{code}</span>{' '}
      <span className="muted">{left}s left</span>{' '}
      <button onClick={get}>refresh</button>
    </span>
  ) : (
    <button onClick={get} disabled={busy}>{busy ? '…' : 'Get 2FA code'}</button>
  );
}
