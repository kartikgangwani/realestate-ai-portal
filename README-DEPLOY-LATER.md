# RealEstate AI — Railway-ready private Test Mode

This is the next deployment-ready foundation. It is not live, and it is deliberately locked to TEST mode.

It adds:

- Server-side password verification using Node scrypt
- HTTP-only, same-site, expiring login sessions
- CSRF protection for every saved change
- PostgreSQL-backed test-state storage
- A private health check for deployment monitoring
- Security headers and a one-megabyte request limit
- Login-attempt throttling
- Local-only test data, reset, activity logs, and reports

It does not include outbound calling, WhatsApp, SMS, email, calendar, property-portal, Meta, payment, map, AI-provider, or any other external integration. Real customer contact details and API credentials are rejected from the stored Test Mode state.

## Keep this offline for now

Continue to use the separate RealEstate-AI-Test-Mode-Windows ZIP for the current single-click offline demo.

This folder needs a PostgreSQL database and environment variables, so it is a deployment package—not another double-click Windows program.

## What we will do later on Railway

1. Create a Railway account and a new private project.
2. Add a PostgreSQL service; Railway provides a DATABASE_URL.
3. Upload this folder to a private GitHub repository or deploy it from a trusted local source.
4. Create the values in the env example file as Railway variables, changing NODE_ENV to production. Never upload an env file.
5. Deploy. The app automatically creates its schema, first TEST admin, and dummy data.
6. Open the generated Railway URL and sign in with the username/password you set.
7. Turn on a custom domain, monitoring, backups, and access policy only after testing.

## Local technical check, later

You need Node.js 20+ and a local PostgreSQL database.

1. Copy the env example file to a file named .env and put in local test values.
2. Run npm install.
3. Start with: node --env-file=.env server.js
4. Open http://localhost:3000.

Use a long, unique password and session secret even for local testing. The first password becomes the portal admin password.

## Before any internet deployment

- [ ] Railway account and billing owner confirmed by you
- [ ] Unique admin password and 32+ character session secret created
- [ ] PostgreSQL service created
- [ ] A private repository or trusted deployment source chosen
- [ ] A backup and restore test completed
- [ ] Test Mode workflow checked with only dummy data
- [ ] HTTPS URL reviewed
- [ ] Real communications still disabled

## Future Live Mode

Live Mode is intentionally not in this package. It requires separate written decisions for data ownership, consent, message/call policies, provider accounts, role-based access, audit retention, security review, backups, and legal/compliance requirements.
