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

## ⇄ Handover — current state

**Last touched:** 27 Aug 2026 by Alex · branch `handoff-subaccount-infrastructure` · status: handed off to tech/IT

**What this project is, in one paragraph.** An internal dashboard for provisioning and managing
additional social accounts for agency clients. It buys domains, wires catch-all email, tracks
which client owns which browser profile, proxy, phone number and address, generates 2FA codes
server-side, and models the cost. The intended operator is an entry-level employee who does data
entry, not someone technical, so anything that requires reading a vendor dashboard is a bug.

**Done**
- **Dashboard MVP** deployed on Vercel: clients, resource inventory, identity capacity guardrails,
  30-day recycle eligibility, cost model, audit log, handle finder.
- **2FA code retrieval** — RFC 6238 TOTP computed server-side, verified against an independent
  implementation. The browser only ever receives six digits. `src/app/api/totp/route.ts`.
- **Domain pipeline, fully automated end to end.** `scripts/register-domain.mjs` (dry-run by
  default, `--confirm` to spend) then `scripts/setup-email.mjs`. Registers at Spaceship, creates
  the Cloudflare zone, sets nameservers, waits for delegation, enables email routing, sets
  catch-all. About 90 seconds, most of it DNS.
- **Two live domains**: `360bnbhosting.cc` and `360bnbstays.cc`. Both active, catch-all forwarding
  to alex@growthopia.io, MX and SPF published. Delivery confirmed on the first.
- **Cost model** in `src/lib/cost.ts` and the Math tab of the Subaccount Database sheet, with real
  vendor ladders and notes on every variable.
- **Handle finder** — brand-extension name ideas via the local `claude` CLI (or the API when a key
  is set), with domain availability from RDAP.
- **Pre-flight check** (`scripts/preflight.mjs`) — go/no-go across proxies, browser profiles,
  domains and email routing, including independent IP reputation lookups.
- **Env sync** (`scripts/sync-env.mjs`) — one local `.env` mirrored to Vercel. Alex fills in one
  file, nothing is typed into a web form.

**Half-finished**
- **Nothing is mid-edit.** Every script runs and every check passes except the deliberate blockers
  listed below.
- **The dashboard still reads seed data** from `src/lib/store.ts`. The Supabase project exists and
  authenticates, but no schema has been created and nothing reads from it yet.

**Tried and failed**
- **Shared static residential proxies ($0.30/IP) cannot pass Instagram signup.** Infinite CAPTCHA
  loop. A dedicated IP ($0.825/IP) cleared it immediately on the same account. Shared is only
  usable after an account exists, never for creating one.
- **Proxies were in France and Italy.** Nobody checked the country column for weeks. Paired with a
  US phone number, that is a textbook geographic mismatch and is the most likely single cause of
  the failed signup and the SMS codes that never arrived. Now all 10 are US.
- **6 of the 10 US replacement IPs are still publicly flagged as proxies** — the whole
  `9.249.x.x` (Astound) range. Replacing one for another in that range will not help.
- **Instagram phone verification is unsolved.** Email verification passed on a two-hour-old domain,
  then it demanded a phone. Two TextVerified numbers received nothing, the third hit
  "Too Many SMS codes, wait 24 hours". That lockout is on the signup session after roughly three
  attempts, not on the number.
- **Instagram routes verification codes to WhatsApp by default** on numbers it thinks may have it.
  A rented number has no WhatsApp, so the code goes nowhere. Click "Send code via SMS" immediately
  rather than waiting.
- **Yahoo and Hotmail were both dead ends for mailboxes.** Yahoo rejected the numbers; Microsoft
  blocked account creation outright with "unusual activity". Custom domain plus Cloudflare
  catch-all replaced both and costs about $8/year per domain.
- **Instagram and TikTok handle availability cannot be checked programmatically.** Both return HTTP
  200 for every handle when logged out, serving the same JS shell. Only YouTube gives a real signal
  (404 vs 200). oEmbed does not help — it only resolves individual videos. Do not trust any
  "username checker" claiming otherwise.
- **Vendor blog statistics are worthless.** Success-rate figures for SMS providers came from sites
  that sell competing SMS services. Retracted. Only first-party measurements belong in this repo.
- **The cheap TLDs are the expensive ones.** `.shop` renews at $31.25 against a $0.90 first year,
  `.site` and `.online` at $20.18 against $1.18. `.cc` at $8.26 is the cheapest renewal of any
  usable TLD, below `.com` at $10.18. The TLD table deliberately stores renewals only.

**Next step**
- **Build Supabase auth before anything else.** The deployed dashboard is publicly reachable and
  has a working "Get 2FA code" button on it. Create the schema, add Google sign-in restricted to
  the domain in `GOOGLE_ALLOWED_DOMAIN`, and move TOTP secrets into a table with row-level security
  denying all client reads, readable only by an Edge Function.

**Blocked on**
- **No successful Instagram signup yet.** The next attempt should use a clean unflagged New York
  IP (`48.46.12.223` or `48.46.14.78`), a TextVerified number with a matching `718`/`347`/`929`
  area code chosen via their filter button, and `hello@360bnbstays.cc`. Until that succeeds the
  phone-strategy line in the cost model is a guess.
- **Vercel Deployment Protection does not cover production domains on the Hobby plan.** Real
  in-app auth is required, not optional.

**Watch out for**
- **Replacing proxies on Webshare leaves GoLogin profiles pointing at IPs you no longer own.** The
  profile looks completely normal. This nearly cost a signup attempt. `scripts/bind-proxy.mjs`
  rebinds and now refuses flagged IPs; `preflight.mjs` blocks on a stale binding.
- **Use HTTP, not SOCKS5, for Microsoft.** Same IP, microsoft.com 502s over SOCKS5 and loads over
  HTTP. Instagram works on both. Protocol is per-identity, not a global default.
- **The Cloudflare API token needs five permissions,** and the two account-scoped ones are in a
  different dropdown from the rest: `Account > Email Routing Addresses > Edit`,
  `Account`-scope resources set to all accounts, plus `Zone > Zone > Edit`, `Zone > DNS > Edit`,
  `Zone > Email Routing Rules > Edit`, `Zone > Zone Settings > Edit`. Zone Resources must be
  "All zones", or new zones cannot be created.
- **Spaceship registration needs a contact ID first** (`PUT /v1/contacts`); there is no endpoint to
  list contacts. The existing one is cached in `.spaceship-contact.json`, which is gitignored.
  Losing it means creating a duplicate contact, not a disaster but untidy.
- **A just-registered Spaceship domain reports "Domain transfer not found"** on the nameserver
  endpoint for the first minute. `setup-email.mjs` retries five times; do not treat it as fatal.
- **RDAP hostnames cannot be guessed** — `.com` is `rdap.verisign.com`, `.cc` is
  `tld-rdap.verisign.com`. `src/lib/domains.ts` routes via IANA's bootstrap file.
- **Credential names only** (values live in `.env`, gitignored, and in Vercel env vars):
  `SPACESHIP_API_KEY`, `SPACESHIP_API_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_DESTINATION_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `TOTP_ENCRYPTION_KEY`,
  `WEBSHARE_API_KEY`, `GOLOGIN_API_TOKEN`, `VERCEL_TOKEN`, `GOOGLE_ALLOWED_DOMAIN`,
  `ANTHROPIC_API_KEY`.
- **Never put a real TOTP secret in `src/lib/store.ts`.** The seed value is the public RFC example.
  Real secrets go in the locked Supabase table from day one, or they end up in git and in the build.
- **The audit log is in-memory** and resets on every deploy.
- **Vista Social is excluded from the cost model on purpose.** It is budgeted separately and prices
  per connected profile at roughly $5, which would dominate everything else.

**Ideas / parked**
- **IMAP reader** so "Get email code" sits next to "Get 2FA code" and staff never open a mail
  client. Cloudflare catch-all forwards to one inbox, so this is one IMAP connection, not one per
  client. Probably the highest-value remaining feature after auth.
- **One "Provision client" button** wiring domains, zones, catch-all, GoLogin profiles and proxies
  into a single action, with the pre-flight surfaced as a red banner rather than a script.
- **Second SMS provider** as a fallback. Pools burn and vendors disappear. No recommendation on
  which — the only honest data would be first-party success rates, which we do not have yet.
- **Monitor TextVerified credit balance and Webshare bandwidth** in the dashboard. Both fail
  silently when exhausted.
- **Ask TextVerified to raise the concurrent verification limit** before staff work a queue.
- **Map more cities to area codes** in `src/lib/webshare.ts` — New Jersey and Cheyenne are
  currently unmapped, so the pre-flight cannot suggest codes for them.
- **Deliberately out of scope for this repo:** browser-fingerprint manipulation, persona or
  lookalike-identity generation, and anything whose purpose is preventing a platform from
  determining that the accounts share an operator. The handle finder produces brand-extension
  names only — variations that visibly belong to the client's business. Whoever picks this up
  should know that boundary was set deliberately and is not an oversight.

## Live resources

- **360bnbhosting.cc** - registered 2026-08-27 via the Spaceship API. $3.11 first year, $8.26 renewal, auto-renew ON, WHOIS privacy high.
- **Spaceship contact ID** - cached in `.spaceship-contact.json` (gitignored). There is no endpoint to list contacts, only to create, so this one is reused for every future registration. Losing it means creating a duplicate contact.
- **Cloudflare destination** - alex@growthopia.io, catch-all target for every client domain.

## Decisions

- **2026-08-26 - Cost target is $10-15/client/month.** Reachable. At 3 accounts per platform and annual billing the infra lands near $1.70-2.80/client. Phone strategy is the only lever that can break it.
- **2026-08-26 - GoLogin Professional 10 is the entry plan**, $9/mo or $4.50 annual. The original handoff doc assumed Business at $119, which was 13x too expensive at low client counts.
- **2026-08-26 - Annual billing on both vendors.** Halves GoLogin at every tier, cuts Webshare about a third. No case where monthly wins.
- **2026-08-27 - Proxies must be dedicated for account creation.** Shared failed Instagram outright. +$0.52/client/month, which the budget absorbs easily.
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
- 🔴 **Shared static residential proxies cannot pass Instagram signup.** Measured 2026-08-27: the shared tier ($0.30/IP) produced an infinite CAPTCHA loop. A dedicated IP ($0.825/IP) cleared it immediately on the same account. Shared is only usable for work after an account exists, never for creating one. The cost model now defaults to dedicated.
- 🔴 **Instagram locks the signup session after ~3 phone attempts**, with "Too Many SMS codes... wait 24 hours". Line up a working number BEFORE starting a signup - you do not get to shop around mid-flow.
- **A two-hour-old domain passed Instagram's email verification.** Domain age was not a blocker at signup, so the buy-early advice was overcautious for IG at least.
- **Instagram requires a phone number after email verification.** Phone strategy A (email only) is dead for IG. Strategy D or B.
- **Cloudflare token needs FOUR account-scoped permissions, not three.** Zone creation fails with `com.cloudflare.api.account.zone.create` unless `Account > Zone > Edit` is on the token, and destination addresses need `Account > Email Routing Addresses > Edit`. Both live under the **Account** scope in the first dropdown - the Zone scope list does not contain them.
- **Spaceship registration needs a contact ID first.** `PUT /v1/contacts` returns one; there is no GET to list them. Registration is `POST /v1/domains/{domain}` and bills the default payment method irreversibly.
- **Cap accounts per email domain and space the signups.** Alex has seen accounts restricted for reusing one domain across several signups. Enforced in `lib/store.ts`: 2 accounts on a domain under 180 days old, 5 on an aged one, and at least 2 days between signups on the same domain. Domain age and velocity are the likely real drivers, so an aged client domain carries more load than a freshly bought one.
- **The handle finder needs `ANTHROPIC_API_KEY` on Vercel.** There is no `claude` CLI in a serverless runtime, so the AI step falls back to rule-based ideas only until the key is set.

## Scope note

The handle finder produces **brand-extension** names: every suggestion visibly
belongs to the client's business, the same way a domain search returns variations
on a company name. Persona and lookalike-identity generation is out of scope.

---

### 27 Aug 2026 — first live domains, and the signup wall

Bought and fully provisioned `360bnbhosting.cc` then `360bnbstays.cc` end to end through the API:
register, Cloudflare zone, nameservers, delegation, MX records, catch-all. Confirmed a real email
lands. The email layer the original handoff doc called "the major unresolved decision" is solved
and costs about $8/year per domain.

Instagram signup got through email verification on a two-hour-old domain, then stalled at phone.
Root cause hunt found the proxies were in France and Italy the whole time, paired with a West
Virginia number — the exact geographic mismatch the SMS provider's own FAQ names as a reason
platforms stop sending codes. Proxies replaced with US, but 6 of 10 replacements are still
publicly flagged as proxies.

Added `preflight.mjs` to catch all of this before an attempt is spent, including a stale-binding
check after it initially passed a profile pointing at a proxy that had been replaced.

Handed to a tech/IT person at this point. Phone verification is the open problem.
