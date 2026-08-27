import './globals.css';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/supabase/session';
import SignOut from './SignOut';

export const metadata: Metadata = {
  title: 'Growthopia Subaccounts',
  description: 'Internal provisioning and credential dashboard',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="inner">
            <strong>Growthopia Subaccounts</strong>
            {user && (
              <nav>
                <a href="/">Clients</a>
                <a href="/names">Handle finder</a>
                <a href="/costs">Cost model</a>
                <a href="/audit">Audit log</a>
                {user.admin && <a href="/admin">Admin</a>}
              </nav>
            )}
            {user && (
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="muted">
                  {user.email}
                  {user.admin && <span className="pill ok" style={{ marginLeft: 6 }}>admin</span>}
                </span>
                <SignOut />
              </span>
            )}
          </div>
        </header>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
