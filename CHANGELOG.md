# Changelog

All notable changes are recorded here. Each entry corresponds to a squash-merged PR title (claude.md §6.4).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses [semver](https://semver.org/).

## [Unreleased]
### Added
- feat(captures): allow `unknown → food` capture state transition (PR-A of ADR-0003 Diary consolidation). Adds pure `domain/permissions/retry.policy.js` deciding whether a viewer is the owner or in the owner's coach upline, ready for PR-A.2 to wire into a `POST /api/captures/retry-promotion` endpoint. Locks in food-corrections search latest-wins dedup via regression test (no runtime behaviour change). [ai-assisted: Copilot (Claude Opus 4.7)]
- feat(quick-share): public recipient-viewable link. `POST /api/quick-share/captures` returns `{ token, viewUrl, expiresAt }`; Gemini food analysis runs in background; `GET /api/quick-share/public/:token` and `/s/[token]` serve a PII-redacted nutrition view. 30-day expiry. Camera-first flag is now **default ON** for members (opt out via `REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST=false`). Migration: `add_quick_share_public_token.sql` (2 nullable columns on `food_nutrition_data_table`). [ai-assisted: Copilot]
- feat(quick-share): camera-first capture with direct WhatsApp image share (flagged off by default behind `REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST`). Member taps shutter → photo shared directly via existing shareImageDirectly → navigates Home. No backend required.
- Engineering governance framework: `claude.md`, `/governance/`, PR template, CODEOWNERS, CI workflows, automation scripts.
