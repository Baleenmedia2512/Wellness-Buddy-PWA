# Security Runbook

Reference: [claude.md §8](../claude.md#8-security-governance).

## 1. Threat model entry (per feature)

Every feature `README.md` MUST contain a `## Threat Model` section answering:
- What data does it read/write? Sensitivity (PII, financial, health)?
- Who can call it? Auth + authz rules.
- External integrations? Trust boundary?
- Possible abuse cases?
- Rate-limit + lockout settings.

## 2. Secret management

- Local dev: `.env.local` (gitignored). Template: `.env.example`.
- CI: GitHub encrypted secrets, scoped per environment.
- Prod: Vercel encrypted env vars; rotated per `SECURITY.md` schedule.
- Pre-commit: `gitleaks protect --staged --redact`.
- Rotation: any leak rotates within 24 h; logged in `governance/SECURITY_INCIDENTS.md`.

## 3. Identity & sessions

- Bcrypt cost ≥ 12.
- Session tokens ≤ 24 h.
- Refresh tokens rotate on use; previous one revoked.
- MFA roadmap tracked in issue `#mfa-rollout`.

## 4. Authorisation

- Every API request resolves the caller → policy module decides.
- RLS on every Supabase table.
- Never trust client-sent `teamId`, `role`, `coachId`. Re-resolve from session.

## 5. Headers (Next.js)

`backend/next.config.js` MUST set:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: <strict policy>` — review per release.
- `Permissions-Policy: geolocation=(self), camera=(self)`

## 6. Outbound network

Any helper that performs an outbound `fetch` MUST consult an allow-list. New domains require an ADR.

## 7. Incident response

1. Triage in `#sec-oncall`, set severity.
2. Open issue with `incident` label.
3. Rotate any exposed credentials immediately.
4. If user data at risk → notify CTO within 1 h.
5. After resolution: blameless post-mortem in `governance/postmortems/`.

## 8. Compliance hooks (placeholder)

- GDPR delete: route `backend/pages/api/user/delete.js` triggers cascade in domain/permissions.
- Data export: route `backend/pages/api/user/export.js`.
- Audit log: every `domain/` write emits an event to `audit_log` table.
