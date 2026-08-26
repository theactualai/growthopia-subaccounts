# Project Progress - Growthopia Subaccounts

Internal tool for provisioning and managing additional social accounts for
clients: inventory, credentials, 2FA retrieval, cost modelling and client handoff.

Separate from the fulfillment overhaul in `Growthopia Ops`. Same company, different system.

## How to run

```
npm install
npm run dev      # http://localhost:3111
```

Seed data only. No env vars required for the preview.

## Where things stand

- ✅ **Cost model** - live in the [Subaccount Database sheet](https://docs.google.com/spreadsheets/d/1oxzf6Tql5lL7Ci2YJ0zA1kjnjm1t_m_sSe6HbsAeiiM/edit), Math tab. One consolidated table, dropdown filters, notes on every variable.
- ✅ **Dashboard MVP** - clients, resource inventory, identity capacity, recycle eligibility, cost model, audit log.
- ✅ **2FA retrieval** - RFC 6238 TOTP computed server side. Browser only ever receives six digits.
- ✅ **Handle finder** - brand-extension handle and email ideas for a client, with availability checking. Runs on the local `claude` CLI in dev, the Anthropic API when `ANTHROPIC_API_KEY` is set.
- ⬜ **Supabase** - swap `src/lib/store.ts` for real tables. Secrets table with RLS denying all client reads.
- ⬜ **Google SSO** - restrict to the workspace domain, not just an invite list.
- 🟡 **Vercel deploy** - repo pushed to GitHub, connect it in Vercel.
- ⬜ **GoLogin + Webshare adapters** - create identities and allocate proxies from the dashboard.
- ⬜ **Monday.com client sync** - pull the client list rather than keeping a second one.

## Decisions

- **2026-08-26 - Cost target is $10-15/client/month.** Reachable. At 3 accounts per platform and annual billing the infra lands near $1.70-2.80/client. Phone strategy is the only lever that can break it.
- **2026-08-26 - GoLogin Professional 10 is the entry plan**, $9/mo or $4.50 annual. The original handoff doc assumed Business at $119, which was 13x too expensive at low client counts.
- **2026-08-26 - Annual billing on both vendors.** Halves GoLogin at every tier, cuts Webshare about a third. No case where monthly wins.
- **2026-08-26 - Phone approach undecided pending a test.** Whether a number can be removed after switching to an authenticator decides between strategy A ($1.09/client) and D ($3.75/client). Google is the one expected to refuse.
- **2026-08-26 - TOTP secrets never reach the browser.** Server-side generation only. This is a hard constraint, not a preference.
- **2026-08-26 - Proxy protocol is per-identity, not global.** HTTP works where SOCKS5 fails on Microsoft. Do not hardcode a protocol; store what actually worked.

## Gotchas

- **Vendor pricing is stepped, not linear.** Cost per client jumps at each tier boundary. The cheapest client counts are 10, 50, 100 and 300. At 15 clients you pay for 50 GoLogin profiles.
- **Webshare has a 20-proxy minimum.** $6.00/mo monthly, $4.00 yearly, however few you need.
- **The audit log is in-memory.** It resets on redeploy until Supabase lands.
- **Vista Social is excluded from the cost model** on purpose. It is budgeted separately and prices per connected profile at about $5, which would dominate everything else.
- **Only YouTube can be availability-checked.** Measured 2026-08-26: YouTube returns 404 for a free handle and 200 for a taken one. Instagram and TikTok return 200 for *every* handle when logged out, both serving the same JS shell, so there is no honest check. oEmbed does not help - both reject profile URLs and only resolve individual videos. The UI shows a "check" link for those two rather than a made-up verdict. Real IG/TikTok checks need an authenticated session or a paid scraping API.
- **Use HTTP, not SOCKS5, for Microsoft.** Confirmed 2026-08-26: microsoft.com returned a 502 error page through the Webshare proxy on SOCKS5 and loaded fine on HTTP, on the same IP, while Instagram worked on both. The handoff doc recommended SOCKS5 with HTTP as a fallback; for Microsoft it is the other way round. Record the working protocol per identity in `ProxyResource.protocol` rather than assuming one default.
- **The handle finder needs `ANTHROPIC_API_KEY` on Vercel.** There is no `claude` CLI in a serverless runtime, so the AI step falls back to rule-based ideas only until the key is set.

## Scope note

The handle finder produces **brand-extension** names: every suggestion visibly
belongs to the client's business, the same way a domain search returns variations
on a company name. Persona and lookalike-identity generation is out of scope.
