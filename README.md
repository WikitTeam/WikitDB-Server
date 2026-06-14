# WikitDB Server

WikitDB is a Next.js application that aggregates Wikidot page, author, rating,
and forum data. It also provides authenticated community tools backed by
PostgreSQL and Prisma.

## Requirements

- Node.js 20 or newer
- PostgreSQL

## Setup

1. Copy `.env.example` to `.env` and fill in the required values.
2. Install dependencies with `npm install`.
3. Apply the Prisma schema with `npm run prisma:push`.
4. Start development with `npm run dev`.

Production validation:

```text
npm test
npm run build
```

## Security Notes

- Set `SITE_ORIGIN` to the public HTTPS origin.
- Set `TRUST_PROXY=true` only when requests always pass through a trusted
  reverse proxy that overwrites forwarding headers.
- Administrator access is controlled only by the `User.isAdmin` database
  field. There is no username-based administrator fallback.
- Runtime data and credentials must not be committed under `data/` or in
  environment files.
- Wikidot management proxy tools only accept HTTPS origins listed in
  `wikitdb.config.js`.

The schema includes persistent registration verification records and bounty
claim idempotency. Deployments upgrading from an older revision must run
`npm run prisma:push` before serving traffic.
