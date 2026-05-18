# quick-share — Test Matrix

| Capability                        | Unit | Integration | E2E | Permissions | Edge cases |
|-----------------------------------|------|-------------|-----|-------------|------------|
| Create capture (insert + token)   |  ✅  |     —       |  —  |     —       |   ✅ (8)   |
| Validate request body             |  ✅  |     —       |  —  |     —       |   ✅ (8)   |
| Token generation / expiry         |  ✅  |     —       |  —  |     —       |   ✅ (7)   |
| Public payload PII redaction      |  ✅  |     —       |  —  |     ✅      |   ✅ (8)   |
| Public GET — expired token        |  ✅  |     —       |  —  |     ✅      |   ✅       |
| Public GET — not found / deleted  |  ✅  |     —       |  —  |     ✅      |   ✅       |
| Public GET — pending analysis     |  ✅  |     —       |  —  |     —       |   ✅       |
| Background Gemini call            |  —   |     —       |  —  |     —       |   — (logged-only path; cron retry planned) |

Coverage floors (claude.md §9.1):
- `validation/` — 95% / 90%
- `domain/`     — 95% / 90%
- `api/`        — 85% / 75%  *(create-capture / get-public handlers covered by domain + validator suites; integration suite is a follow-up — flag stays OFF in prod)*
- `data/`       — 70% / 60%  *(supabase repo, mocked via existing pattern in follow-up)*
