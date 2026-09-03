# Growthopia Subaccounts

An internal dashboard for provisioning and managing the infrastructure behind a
marketing agency's client social media accounts: domains, email routing, browser
profiles, proxies, phone verification, credentials and cost.

Built to be operated by someone non-technical. If a task requires reading a
vendor dashboard, that is treated as a bug.

**Status:** working infrastructure pipeline, dashboard with Google SSO deployed,
one unsolved problem (phone verification). Details below.

---

## Contents

- [The problem](#the-problem)
- [How it works](#how-it-works)
- [What is built](#what-is-built)
- [What it costs](#what-it-costs)
- [What we learned the hard way](#what-we-learned-the-hard-way)
- [Open problems](#open-problems)
- [Setup](#setup)
- [Scripts](#scripts)
- [Scope](#scope)

---

## The problem

A marketing agency runs social media for business clients. Beyond a client's
main account, the agency creates additional openly-branded accounts — a clips
account, a per-service-line account, a per-city account — to widen distribution.
Think `@360bnbsolutions` plus `@360bnbstays` and `@360bnbcleaning`.

Each of those accounts needs an email address, sometimes a phone number, a
password, a 2FA method, and a record of which client owns it so it can be handed
over when the relationship ends. Multiply by three platforms and a book of
clients and the bookkeeping becomes the actual job.

Before this tool that meant four vendor dashboards, a spreadsheet, and 2FA codes
living on one person's phone. The goals:

1. **One place** for every resource, mapped to the client who owns it.
2. **Nothing lives on a personal device.** 2FA codes come from the dashboard.
3. **Clean handover.** A client leaving gets their accounts, not a spreadsheet of passwords.
4. **Operable by an entry-level employee** who does data entry, not systems administration.
5. **Under $10–15 per client per month.**

---

## How it works

Six layers, each behind an adapter so a vendor can be swapped without a rewrite.

| Layer | Vendor | Why |
|---|---|---|
| Domains | Spaceship | Full REST API for buy, renew, DNS, nameservers |
| Email | Cloudflare Email Routing | Free, full API, catch-all means addresses need no provisioning |
| Browser profiles | GoLogin | Session isolation per client, REST API |
| Proxies | Webshare | Static residential, API for inventory and replacement |
| Phone | TextVerified | Non-VoIP US numbers with selectable area code |
| Data, auth, secrets | Supabase | Postgres with row-level security, Google SSO |

### The domain and email pipeline

The part that is fully automated. One command takes a name to a working inbox in
about 90 seconds:

```
register at Spaceship
  → create the Cloudflare zone, collect its nameservers
  → point the domain at them
  → wait for DNS delegation
  → enable email routing (writes MX + SPF)
  → set a catch-all rule
```

The catch-all is the important part. **No email address is ever created.**
Once the domain is live, `anything@thedomain.cc` already works, so provisioning
an address costs nothing and takes no time.

### The 2FA design

Secrets never reach the browser. A TOTP code is six digits derived from a shared
secret and the current time, so the secret can stay server-side and only the code
crosses the wire.

- Secrets live in a Postgres table with RLS enabled and **no policy at all**, so
  PostgREST returns nothing to any browser session.
- Only the server-side service role reads them.
- Every retrieval writes an audit row, because pulling a code is effectively
  "someone signed in to this account".

The practical win is offboarding: revoke someone's Google account and they lose
access to every client account at once, which a shared authenticator app can
never do.

---

## What is built

**Dashboard** (Next.js 15, deployed on Vercel)

- **Google SSO** restricted to one Workspace domain. Every route is behind
  middleware, so an unauthenticated request never reaches a component.
- **Admin panel** — access settings, vendor credential status (presence only,
  never values), inventory counts, recent activity.
- **Clients** — accounts mapped to identity, proxy, email, phone and 2FA method.
- **Infrastructure** — live go/no-go across every vendor, with independent proxy
  reputation, which profile each IP is bound to, and the phone area code to
  request for each proxy's city.
- **Handle finder** — brand-extension name ideas with availability checking.
- **Cost model** — the full model with adjustable assumptions.
- **Audit log** — every privileged action.

**Vendor adapters** — `src/lib/{spaceship,cloudflare,webshare,gologin}.ts`

**Scripts** — provisioning, pre-flight, diagnostics, env sync, migrations.

**Schema** — `supabase/migrations/0001_init.sql`

---

## What it costs

Per client per month, at 3 accounts on each of 3 platforms, 100 clients, annual
billing. Real vendor prices, checked August 2026.

| Line | Cost | Note |
|---|---|---|
| GoLogin | $0.40 | Flat plan fee ÷ clients. Professional 10 profiles is $4.50/mo annual |
| Proxies | $0.82 | Dedicated static residential, $0.825/IP |
| Domains | ~$3.10 | ~4.5 domains/client at $8.26/yr |
| Phone | $1.09–$3.75 | Depends on strategy, see below |
| **Total** | **~$5.40–8.10** | Against a $10–15 target |

Excluded on purpose: the scheduling tool, which is budgeted separately and prices
per connected profile.

### Phone strategy decides the budget

| Strategy | $/client/mo | |
|---|---|---|
| A — one-time codes only | $1.09 | Cheapest. Requires the number to be removable after switching to an authenticator |
| B — codes + retained rentals | $11.09 | Keeps a number where it cannot be removed |
| C — a rented number per account | $45.00 | Breaks the budget on its own |
| D — rent for setup, then release | $3.75 | The realistic fallback |

### TLD choice: renewal is the only number that matters

First-year prices are loss leaders and invert the ranking.

| TLD | First year | **Renewal** |
|---|---|---|
| .shop | $0.90 | **$31.25** |
| .site / .online | $1.18 | **$20.18** |
| .live | $2.27 | **$26.08** |
| **.cc** | $3.11 | **$8.26** |
| .com | $9.08 | $10.18 |

`.cc` is the cheapest thing you can hold, and it is run by Verisign, the same
registry as `.com`. Every TLD that beats it on year one costs two to four times
more from year two.

---

## What we learned the hard way

The most useful section for anyone doing something similar. All of it measured,
none of it from vendor marketing.

**Proxies**

- **Shared static residential cannot pass Instagram signup.** Infinite CAPTCHA
  loop. A dedicated IP cleared it immediately on the same account. Shared is fine
  for work after an account exists, never for creating one.
- **Check the country column.** Ours were in France and Italy for weeks while
  being paired with US phone numbers. That mismatch is on the SMS provider's own
  list of reasons platforms stop sending codes.
- **Vendor labels are not reputation.** 6 of 10 US IPs came back flagged as
  proxies by a free public database. Anything a free lookup can see, a platform
  can see. The pre-flight now checks this independently.
- **Replacing a proxy leaves browser profiles pointing at the old IP.** The
  profile looks completely normal. This is the highest-value check in the tool.
- **Protocol is per-identity.** `microsoft.com` returns 502 over SOCKS5 and loads
  fine over HTTP on the same IP. Instagram works on both.

**Email**

- **Consumer providers are a dead end at any scale.** Yahoo rejected our numbers;
  Microsoft blocked account creation outright for "unusual activity". A custom
  domain with a catch-all replaced both for about $8/year.
- **Domain age was not a blocker.** A two-hour-old domain passed Instagram's
  email verification.
- **Platforms do not reject a TLD.** They score domain age, MX configuration,
  authentication and blocklist presence. A `.cc` you own scores neutral; a known
  disposable domain does not.

**Phone verification**

- **Instagram requires a phone after email.** There is no phone-free path.
- **It routes codes to WhatsApp by default.** A rented number has no WhatsApp, so
  the code goes nowhere. Click "Send code via SMS" immediately.
- **You get about three attempts** before a 24-hour lockout on the signup session.
  Have a working number before you start; there is no shopping around mid-flow.
- **Match the area code to the proxy's city.**

**Availability checking**

- **Instagram and TikTok cannot be checked programmatically.** Both return HTTP
  200 for every handle when logged out, serving the same JS shell. Only YouTube
  gives a real signal (404 vs 200). Any "username checker" claiming otherwise is
  logged in or guessing.
- **Domains are the opposite.** RDAP is the registry's own protocol and is
  authoritative. Route via IANA's bootstrap file — hostnames cannot be guessed,
  `.com` is `rdap.verisign.com` but `.cc` is `tld-rdap.verisign.com`.

**Vendor APIs**

- Spaceship registration needs a contact ID first; there is no endpoint to list
  contacts, only to create one.
- A just-registered Spaceship domain reports "Domain transfer not found" on the
  nameserver endpoint for about a minute. Retry rather than fail.
- Cloudflare zone creation needs an **account-scoped** `Zone` permission, in a
  different dropdown from the zone-scoped ones. Zone Resources must be "All
  zones", or new zones cannot be created.
- Spacemail has no mailbox API. Cloudflare Email Routing does the same job for
  free with a documented one.

**Deployment**

- Vercel silently blocks deployments whose commit author email does not match a
  GitHub account. Ten deployments sat in `BLOCKED` with no build logs for a day
  while production served stale code. A blocked deployment with no logs is an
  author-email problem, not a billing one.

---

## Open problems

1. **Phone verification is unsolved.** No account has been created end to end.
   Everything up to and including email verification works.
2. **The dashboard still reads seed data.** The schema is written; applying it
   needs the database connection string.
3. **6 of 10 proxies are flagged.** The whole `9.249.x.x` range. Replacing within
   that range will not help.
4. **The audit log is in-memory** until the schema lands.

---

## Setup

```bash
npm install
cp .env.example .env     # then fill it in
npm run dev              # http://localhost:3111
```

Every variable is documented inline in `.env.example`, including where to get it.
`node scripts/sync-env.mjs` mirrors the file to Vercel so nothing is typed twice.

**Nothing secret is in this repo.** `.env` is gitignored. The dashboard shows
whether a credential is set, never its value.

---

## Scripts

| Script | What it does |
|---|---|
| `preflight.mjs` | Go/no-go across every vendor. Run before any signup attempt |
| `register-domain.mjs <domain>` | Registers a domain. Dry run unless `--confirm` |
| `setup-email.mjs <domain>` | Zone, nameservers, MX, catch-all. Safe to re-run |
| `bind-proxy.mjs "<profile>" [city]` | Binds a profile to a clean proxy. **Run after any replacement** |
| `proxy-check.mjs` | Reachability and reputation when a page will not load |
| `validate-env.mjs` | Proves every credential authenticates |
| `sync-env.mjs` | Mirrors `.env` to Vercel |
| `migrate.mjs` | Applies SQL migrations |

Run with `node --experimental-strip-types scripts/<name>.mjs`.

---

## Scope

The handle finder produces **brand-extension names** — variations that visibly
belong to the client's business, the way a domain search returns variations on a
company name. `@360bnbstays` for 360 BnB Solutions.

Deliberately **not** in this repo, and not an oversight:

- Browser fingerprint manipulation
- Persona or lookalike-identity generation
- Anything whose purpose is preventing a platform from determining that a set of
  accounts shares an operator

The accounts this tool manages are openly branded and openly the client's. The
infrastructure here exists to keep track of them, keep them recoverable, and hand
them over cleanly.

---

## Stack

Next.js 15 · React 19 · TypeScript · Supabase (Postgres, Auth) · Vercel

Adapters: Spaceship, Cloudflare, Webshare, GoLogin, TextVerified, Anthropic
