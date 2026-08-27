import { ALLOWED_DOMAIN } from '@/lib/auth';

export default function Denied() {
  return (
    <div style={{ maxWidth: 420, margin: '14vh auto', textAlign: 'center' }}>
      <div className="card" style={{ padding: 32 }}>
        <h1 style={{ margin: '0 0 6px' }}>Not allowed</h1>
        <p className="muted">
          This dashboard is restricted to <b>@{ALLOWED_DOMAIN}</b> accounts. You signed in with a
          Google account outside that domain, so the session was ended.
        </p>
        <p style={{ marginTop: 18 }}><a href="/login">Try a different account</a></p>
      </div>
    </div>
  );
}
