# ADR-0015 — Field collection policy

**Status:** Accepted
**Date:** 2026-11-12
**Owners:** @principal-eng
**Flag:** `ff.field-collection`

## Context

After coach OTP, new members were stopped for a fixed set of fields, including some the business wants later rather than at sign-up. Which fields are required, who can see them, and how often they are asked needs to be changed by an admin without another app release.

## Decision

1. Community Position is always first and mandatory for members and coaches. No other field is asked until it is saved. Admin and developer accounts are not stopped.
2. Every other field has an audience (member, coach, or both) and a community-position list (all, or specific positions). A person outside that audience or position does not see the field and is not required to fill it.
3. A field is either required while entering (no skip) or asked later. Later fields use three admin numbers: how often to ask (IST days), how many skips are allowed, and the day by which it must be filled. After the skip limit or that day, Skip is removed.
4. Defaults while entering: Gender, Age, Height, Diet, Lifestyle, Left, Centre, Right. Later: Current weight every 1 day, Fat % / Body age / Chest / Waist / Hip every 3 days, Health issues every 1 day. Later fields start with 2 skips and a must-fill window of interval × 3 days. Admin can change these.
5. Existing profile GET/POST behaviour is unchanged, so already released app bundles keep their onboarding. This UI ships in the next build of this frontend. The flag is a kill switch: when it is off, the app uses the previous screens. Policy reads use the code defaults until `create_field_collection_tables.sql` has been applied. Saving admin rules requires that migration.

### Legacy removal

Remove the previous onboarding screens only after no supported client still depends on them and `ff.field-collection` has been on without rollback. Verify there is no meaningful traffic on the old gates, then propose cleanup.

## Consequences

- Backend can ship before the new app build is listed. Older binaries never call these routes.
- Admin Config Setup gains a Field Collection tab for admin and developer roles.
