# Google Maps Listing — ops playbook

App feature: **Google Maps Listing** (flag `ff.gbp-listing`). Coaches submit a request; humans create the Google Business Profile (GBP). The app does **not** call Google APIs.

## Prerequisites

1. Migration: `backend/migrations/create_gbp_listing_requests_table.sql` (or auto `ensureSchema` on first API hit).
2. MilesWeb FTP configured (same as coach-portfolio media). Ensure cPanel folder `uploads/gbp-requests/` exists (or FTP create-on-write works).
3. Env: `GBP_LISTING_OPS_EMAIL=ops@example.com` (comma-separated OK) so submit sends mail.
4. Frontend + backend deploy with `ff.gbp-listing` on (default ON).

## Coach path

1. Profile → **Google Maps Listing**
2. Create new → pick owned center → fill GBP fields → upload ≥3 photos → **Submit**
3. Status becomes `submitted`

## How you know a request arrived

1. Email to `GBP_LISTING_OPS_EMAIL` (subject `GBP request #id — name — city`)
2. Profile (admin/developer) → **Maps Listing Queue**

## Create GBP (manual)

1. Open queue → request detail
2. Download / open media from listed URLs (FTP folder `gbp-requests/{userId}/{requestId}/`)
3. In Google Business Profile, create listing by copying form fields **in order**:
   - Business name (real storefront name — not “Digital Portfolio”)
   - Primary category (map our select to nearest Google category)
   - Full address + pin (use center GPS if address is weak)
   - Phone / hours / website / description
   - Upload photos/videos from the media kit
4. NAP must match the form (Name / Address / Phone)
5. Website = form `WebsiteUrl` (usually Digital Portfolio `/coach/...`)
6. After live: paste Maps/GBP URL in admin → status **Live** (required)
7. Use **Needs info** + ops note if coach must fix something

## Success

- Coach hub shows **Live** + **Open in Maps**
- Duplicate edits blocked while Submitted / In progress / Live (coach can edit only Draft / Needs info)
