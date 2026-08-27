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
- ✅ **Vercel deploy** - live at https://growthopia-subaccounts-jgzxnkgr3-growthopia.vercel.app
- 🔴 **No authentication yet** - the deployed dashboard is publicly reachable. Turn on Vercel Deployment Protection until Google SSO lands.
- ⬜ **GoLogin + Webshare adapters** - create identities and allocate proxies from the dashboard.
- ⬜ **Monday.com client sync** - pull the client list rather than keeping a second one.

## Live resources

- **360bnbhosting.cc** - registered 2026-08-27 via the Spaceship API. $3.11 first year, $8.26 renewal, auto-renew ON, WHOIS privacy high.
- **Spaceship contact ID** - cached in `.spaceship-contact.json` (gitignored). There is no endpoint to list contacts, only to create, so this one is reused for every future registration. Losing it means creating a duplicate contact.
- **Cloudflare destination** - alex@growthopia.io, catch-all target for every client domain.

## Decisions

- **2026-08-26 - Cost target is $10-15/client/month.** Reachable. At 3 accounts per platform and annual billing the infra lands near $1.70-2.80/client. Phone strategy is the only lever that can break it.
- **2026-08-26 - GoLogin Professional 10 is the entry plan**, $9/mo or $4.50 annual. The original handoff doc assumed Business at $119, which was 13x too expensive at low client counts.
- **2026-08-26 - Annual billing on both vendors.** Halves GoLogin at every tier, cuts Webshare about a third. No case where monthly wins.
- **2026-08-26 - Phone approach undecided pending a test.** Whether a number can be removed after switching to an authenticator decides between strategy A ($1.09/client) and D ($3.75/client). Google is the one expected to refuse.
- **2026-08-26 - TOTP secrets never reach the browser.** Server-side generation only. This is a hard constraint, not a preference.
- **2026-08-26 - Proxy protocol is per-identity, not global.** HTTP works where SOCKS5 fails on Microsoft. Do not hardcode a protocol; store what actually worked.
- **2026-08-26 - Email domains are a rationed resource.** Spread accounts across the client's aged domain plus service-line domains rather than putting all of them on one. Caps and pacing are enforced in the tool, not left to memory.

## Gotchas

- **Vendor pricing is stepped, not linear.** Cost per client jumps at each tier boundary. The cheapest client counts are 10, 50, 100 and 300. At 15 clients you pay for 50 GoLogin profiles.
- **Webshare has a 20-proxy minimum.** $6.00/mo monthly, $4.00 yearly, however few you need.
- **The audit log is in-memory.** It resets on redeploy until Supabase lands.
- **Vista Social is excluded from the cost model** on purpose. It is budgeted separately and prices per connected profile at about $5, which would dominate everything else.
- **Only YouTube can be availability-checked.** Measured 2026-08-26: YouTube returns 404 for a free handle and 200 for a taken one. Instagram and TikTok return 200 for *every* handle when logged out, both serving the same JS shell, so there is no honest check. oEmbed does not help - both reject profile URLs and only resolve individual videos. The UI shows a "check" link for those two rather than a made-up verdict. Real IG/TikTok checks need an authenticated session or a paid scraping API.
- **Use HTTP, not SOCKS5, for Microsoft.** Confirmed 2026-08-26: microsoft.com returned a 502 error page through the Webshare proxy on SOCKS5 and loaded fine on HTTP, on the same IP, while Instagram worked on both. The handoff doc recommended SOCKS5 with HTTP as a fallback; for Microsoft it is the other way round. Record the working protocol per identity in `ProxyResource.protocol` rather than assuming one default.
- **360bnbsolutions.com was registered 2026-07-23**, so it is ~34 days old, not aged. Verified via RDAP. It gets the low per-domain cap (2), not the aged cap (5). Do not assume a client's own domain is old; check it.
- **Spaceship API covers domains, not mailboxes.** Full REST API at `spaceship.dev/api/v1` (OpenAPI 3.0, `X-API-Key` + `X-API-Secret`): check availability in bulk, register, renew, transfer, manage contacts, nameservers and DNS records. Registration is rate-limited to 30 requests per 30s and some calls return 202 for polling. There are **no Spacemail mailbox endpoints** - the only "email" in the spec is the WHOIS email-protection preference. Provision inboxes with a catch-all instead: the API sets MX, and a catch-all means every address you invent already works with no mailbox to create.
- **RDAP must be routed via the IANA bootstrap.** Guessing the hostname fails: .com is `rdap.verisign.com` but .cc is `tld-rdap.verisign.com`, and rdap.org's redirect times out often enough to fake an "unknown". `lib/domains.ts` fetches `data.iana.org/rdap/dns.json` once and caches the mapping.
- **Domain checks are authoritative, handle checks are not.** RDAP is the registry's own protocol: 404 means available, 200 returns the registration record including age. Use it. The social-handle checks remain best-effort (YouTube only).
- **Cloudflare token needs FOUR account-scoped permissions, not three.** Zone creation fails with `com.cloudflare.api.account.zone.create` unless `Account > Zone > Edit` is on the token, and destination addresses need `Account > Email Routing Addresses > Edit`. Both live under the **Account** scope in the first dropdown - the Zone scope list does not contain them.
- **Spaceship registration needs a contact ID first.** `PUT /v1/contacts` returns one; there is no GET to list them. Registration is `POST /v1/domains/{domain}` and bills the default payment method irreversibly.
- **Cap accounts per email domain and space the signups.** Alex has seen accounts restricted for reusing one domain across several signups. Enforced in `lib/store.ts`: 2 accounts on a domain under 180 days old, 5 on an aged one, and at least 2 days between signups on the same domain. Domain age and velocity are the likely real drivers, so an aged client domain carries more load than a freshly bought one.
- **The handle finder needs `ANTHROPIC_API_KEY` on Vercel.** There is no `claude` CLI in a serverless runtime, so the AI step falls back to rule-based ideas only until the key is set.

## Scope note

The handle finder produces **brand-extension** names: every suggestion visibly
belongs to the client's business, the same way a domain search returns variations
on a company name. Persona and lookalike-identity generation is out of scope.
