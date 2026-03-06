# Security Policy

## Secret management

- Never commit secrets to Git (`.env`, API keys, private certificates, webhook secrets).
- Keep only placeholder values in `.env.example`.
- Store production secrets in Vercel Project Environment Variables and Supabase secrets.
- Use separate values for Development, Preview, and Production environments.

## If a secret is exposed

1. Revoke and regenerate the exposed key immediately in the provider dashboard.
2. Update Vercel and Supabase environment variables.
3. Redeploy impacted services.
4. Rotate dependent credentials (webhooks, API tokens, SMTP, service role keys).
5. Review Git history and incident scope before external communication.

## Reporting

If you discover a security issue, report it privately through GitHub Security Advisories for this repository.
