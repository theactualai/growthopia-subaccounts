# Growthopia Subaccounts

Internal provisioning and credential dashboard for client social accounts.

One place to see which client owns which account, identity, proxy, number and
address, retrieve a 2FA code without anyone handling the secret, and price the
whole thing before spending money.

## Run it

```
npm install
npm run dev      # http://localhost:3111
```

No environment variables needed. The preview runs on seed data in `src/lib/store.ts`.

## What's here

| Page | What it does |
|---|---|
| `/` | Client list, resource counts, provisioning gaps |
| `/clients/[id]` | Accounts, identities, capacity against the per-identity limit, recycle eligibility |
| `/costs` | The cost model, same ladders and maths as the Math tab in the sheet |
| `/audit` | Every privileged action, including each 2FA code view |

## The one rule that matters

`src/app/api/totp/route.ts` computes the code **on the server** and returns six
digits. The secret never reaches the browser. When this moves to Supabase, the
secrets table gets RLS denying all client access and only the Edge Function
reads it, using the service role key that never leaves the server.

If you ever send the secret to the client so the code can tick live in React,
you have handed every account to anyone who opens dev tools.

## Deploying

Vercel, zero config. Nothing here needs a database to render the preview.
Set the variables in `.env.example` when Supabase goes in.

## Sources of truth

- Cost ladders: `src/lib/cost.ts` and the Math tab of the Subaccount Database sheet. Keep them in step.
- Vendor prices were checked 2026-08-26. Re-verify before committing budget.
