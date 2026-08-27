import LoginButton from './LoginButton';
import { ALLOWED_DOMAIN } from '@/lib/auth';

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div style={{ maxWidth: 380, margin: '14vh auto', textAlign: 'center' }}>
      <div className="card" style={{ padding: 32 }}>
        <h1 style={{ margin: '0 0 6px' }}>Growthopia Subaccounts</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in with your <b>@{ALLOWED_DOMAIN}</b> Google account.
        </p>
        {error && (
          <p className="pill warn" style={{ display: 'inline-block', margin: '10px 0' }}>
            {error === 'exchange_failed' ? 'Sign-in failed, try again' : 'Something went wrong'}
          </p>
        )}
        <div style={{ marginTop: 20 }}>
          <LoginButton next={next} />
        </div>
      </div>
    </div>
  );
}
