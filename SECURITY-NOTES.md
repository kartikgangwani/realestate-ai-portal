# Security boundaries

This package is a private Test Mode foundation, not a production launch.

## Included safeguards

- APP_MODE refuses every value except TEST.
- Admin credentials are read from deployment variables and are never hardcoded.
- Passwords are stored as salted scrypt hashes.
- Session tokens are HTTP-only, same-site cookies; only their keyed hash is stored in PostgreSQL.
- Mutating API calls require a server-issued CSRF token.
- Login attempts are throttled in memory.
- The server sends restrictive browser security headers.
- The server serves files only from the public folder.
- Saved state rejects contact-detail and integration-credential fields.

## Operating requirements for later deployment

- Keep the Railway project private until the workflow is approved.
- Set a strong unique admin password and session secret.
- Configure a database backup and perform a restore test.
- Do not enter real customer records while this remains Test Mode.
- Do not add communication providers until consent, compliance, audit, and human-approval controls have been reviewed.
