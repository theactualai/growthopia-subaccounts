import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Growthopia Subaccounts',
  description: 'Internal provisioning and credential dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="inner">
            <strong>Growthopia Subaccounts</strong>
            <nav>
              <a href="/">Clients</a>
              <a href="/names">Handle finder</a>
              <a href="/costs">Cost model</a>
              <a href="/audit">Audit log</a>
            </nav>
          </div>
        </header>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
